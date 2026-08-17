/**
 * 音樂播放功能模組
 *
 * 依賴：@discordjs/voice、play-dl（package.json 已安裝）
 *       系統 ffmpeg（外部程式，不一定存在 → 防禦性檢查）
 *
 * 所有對外函式一律防崩潰：缺少依賴 / 缺少 ffmpeg 時仍正常 export，
 * 並回覆友善的繁中錯誤訊息。
 */

const { logger } = require('../utils/logger');
const { Colors } = require('../utils/constants');
const { formatClock } = require('../utils/format');
const { sendError, sendSuccess, safeReply, withFooter } = require('../utils/embeds');
const { t } = require('../utils/i18n');
const { EmbedBuilder } = require('discord.js');

// ===== 防禦性載入依賴 =====
let enabled = true;
let voice = null;
let playdl = null;

try {
  voice = require('@discordjs/voice');
} catch (e) {
  enabled = false;
  logger.warn('music', '缺少 @discordjs/voice，音樂功能停用');
}
try {
  playdl = require('play-dl');
} catch (e) {
  enabled = false;
  logger.warn('music', '缺少 play-dl，音樂功能停用');
}

// ===== 檢查系統 ffmpeg =====
let ffmpegOk = true;
if (enabled) {
  try {
    const { spawnSync } = require('child_process');
    const r = spawnSync('ffmpeg', ['-version'], { timeout: 8000, stdio: 'ignore' });
    ffmpegOk = !!(r && !r.error && r.status === 0);
  } catch (e) {
    ffmpegOk = false;
  }
  if (!ffmpegOk) logger.warn('music', '未找到系統 ffmpeg，音樂功能停用');
}

// ===== 狀態：guildId -> { connection, player, queue, currentIndex, loop, volume, textChannel, ... } =====
const states = new Map();

const EMPTY_MSG = () => t('目前沒有播放中的音樂', 'Nothing is playing right now');
const DISABLED_MSG = () => t('音樂功能無法使用（缺少依賴）', 'Music is unavailable (missing dependency)');
const FFMPEG_MSG = () => t('❌ 機器人需要系統安裝 ffmpeg 才能播放音樂（請見 README）', '❌ The bot needs system ffmpeg installed to play music (see README)');

/** 依循環模式回傳雙語標籤 */
function loopLabel(mode) {
  const labels = {
    off: t('🔁 關閉', '🔁 Off'),
    queue: t('🔂 循環整個佇列', '🔂 Loop queue'),
    one: t('🔁 單曲循環', '🔁 Loop one'),
  };
  return labels[mode] || mode;
}

const LEAVE_DELAY_MS = 60000; // 空頻道 / 播放完畢後等待多久離開
const MAX_FAIL_COUNT = 3; // 連續播放失敗幾次後停止

function createState(textChannelId) {
  return {
    connection: null, // VoiceConnection
    player: null, // AudioPlayer
    queue: [], // [{ title, url, duration, requestedBy }]
    currentIndex: 0,
    loop: 'off', // 'off' | 'queue' | 'one'
    volume: 100, // 0-100
    textChannel: textChannelId || null,
    leaveTimer: null, // setTimeout 控制
    playing: false,
    skipping: false, // 手動跳過/停止中，忽略 idle
    lastError: false,
    failCount: 0,
    playToken: 0, // 防止並發播放的世代號
  };
}

/** 檢查依賴與 ffmpeg，未通過時已回覆錯誤並回傳 false */
async function _checkEnabled(interaction) {
  if (!enabled) {
    await sendError(interaction, DISABLED_MSG());
    return false;
  }
  if (!ffmpegOk) {
    await sendError(interaction, FFMPEG_MSG());
    return false;
  }
  return true;
}

/** 需要播放器且佇列非空的有效狀態，否則回傳 null */
function _getActiveState(guildId) {
  const st = states.get(guildId);
  if (!st || st.queue.length === 0) return null;
  return st;
}

/** 傳訊息到綁定的文字頻道（失敗靜默） */
async function _notifyChannel(client, state, text) {
  if (!client || !state || !state.textChannel) return;
  try {
    const ch = await client.channels.fetch(state.textChannel).catch(() => null);
    if (ch && typeof ch.isTextBased === 'function' && ch.isTextBased()) {
      await ch.send(text).catch(() => {});
    }
  } catch (e) {
    /* 忽略通知錯誤 */
  }
}

/** 離開語音並清空該 guild 的狀態 */
function _leave(guildId) {
  const st = states.get(guildId);
  if (!st) return;
  if (st.leaveTimer) {
    clearTimeout(st.leaveTimer);
    st.leaveTimer = null;
  }
  st.skipping = true;
  try {
    if (st.player) st.player.stop();
  } catch (e) {
    /* 忽略 */
  }
  try {
    if (st.connection) st.connection.destroy();
  } catch (e) {
    /* 忽略 */
  }
  states.delete(guildId);
}

/**
 * 排程離開：延遲後若仍「沒在播、佇列空、頻道沒人」才真正離開。
 * 與 handleVoiceState 共用同一個 timer，避免互相衝突。
 */
function _scheduleLeave(client, guildId, delayMs = LEAVE_DELAY_MS) {
  const st = states.get(guildId);
  if (!st) return;
  if (st.leaveTimer) clearTimeout(st.leaveTimer);
  st.leaveTimer = setTimeout(() => {
    const s = states.get(guildId);
    if (!s) return;
    s.leaveTimer = null;
    if (s.playing || s.queue.length > 0) return; // 有新的播放 → 取消
    const channelId = s.connection?.joinConfig?.channelId;
    let hasHuman = false;
    if (channelId) {
      const ch = client.channels.cache.get(channelId);
      try {
        hasHuman = !!(ch && ch.members && ch.members.some((m) => !m.user.bot));
      } catch (e) {
        hasHuman = false;
      }
    }
    if (hasHuman) return; // 有人留在頻道 → 不離開
    _leave(guildId);
  }, delayMs);
}

/** 佇列播完（off 模式）→ 停止、清空並延遲離開 */
function _endPlayback(client, guildId) {
  const st = states.get(guildId);
  if (!st) return;
  st.playing = false;
  st.queue = [];
  st.currentIndex = 0;
  _notifyChannel(client, st, t('🎵 佇列已全部播放完畢', '🎵 Queue finished playing'));
  _scheduleLeave(client, guildId, LEAVE_DELAY_MS);
}

/**
 * 決定下一首要播什麼。
 * @param {boolean} ignoreOne true 表示使用者手動跳過（忽略單曲循環）
 */
function _next(client, guildId, ignoreOne = false) {
  const st = states.get(guildId);
  if (!st) return;
  if (st.loop === 'one' && !ignoreOne) {
    _playTrack(client, guildId);
    return;
  }
  const nextIdx = st.currentIndex + 1;
  if (nextIdx < st.queue.length) {
    st.currentIndex = nextIdx;
    _playTrack(client, guildId);
    return;
  }
  if (st.loop === 'queue' && st.queue.length > 0) {
    st.currentIndex = 0;
    _playTrack(client, guildId);
    return;
  }
  _endPlayback(client, guildId);
}

/** player idle 事件處理：依 loop 模式決定下一首 */
function _handleIdle(client, guildId) {
  const st = states.get(guildId);
  if (!st) return;
  if (st.skipping) {
    st.skipping = false;
    return;
  }
  // 若玩家已開始播其他資源（跳過後新曲已開始），忽略舊的 idle
  if (st.player && st.player.state.status !== voice.AudioPlayerStatus.Idle) return;
  if (st.lastError) {
    st.lastError = false;
    st.failCount = (st.failCount || 0) + 1;
    _notifyChannel(client, st, t('❌ 播放時發生錯誤，嘗試播放下一首…', '❌ Playback error, trying the next track…'));
    if (st.failCount >= MAX_FAIL_COUNT) {
      _notifyChannel(client, st, t('❌ 連續播放失敗，已停止播放', '❌ Multiple playback failures, stopped playing'));
      _endPlayback(client, guildId);
      return;
    }
    _next(client, guildId);
    return;
  }
  st.failCount = 0;
  _next(client, guildId);
}

/** 建立 player 並綁定事件（每個 guild 只建一次） */
function _ensurePlayer(client, guildId) {
  const st = states.get(guildId);
  if (!st) return null;
  if (!st.player) {
    st.player = voice.createAudioPlayer({
      behaviors: { noSubscriber: voice.NoSubscriberBehavior.Play },
    });
    st.player.on('idle', () => _handleIdle(client, guildId));
    st.player.on('error', (err) => {
      logger.error('music', `音訊播放錯誤（${guildId}）：${err.message || err}`);
      const s = states.get(guildId);
      if (s) s.lastError = true;
    });
    if (st.connection) st.connection.subscribe(st.player);
  }
  return st.player;
}

/** 播放目前 currentIndex 指向的曲目（play-dl stream 需 await） */
async function _playTrack(client, guildId) {
  const st = states.get(guildId);
  if (!st) return;
  const track = st.queue[st.currentIndex];
  if (!track) {
    _endPlayback(client, guildId);
    return;
  }
  st.playing = true;
  st.failCount = 0;
  st.lastError = false;
  st.playToken = (st.playToken || 0) + 1;
  const token = st.playToken;
  try {
    const stream = await playdl.stream(track.url, { quality: 0 });
    const cur = states.get(guildId);
    // 等待串流期間可能已被停止/跳過 → 丟棄這次播放
    if (!cur || cur !== st || cur.playToken !== token) {
      try {
        if (stream && typeof stream.destroy === 'function') stream.destroy();
      } catch (e) {
        /* 忽略 */
      }
      return;
    }
    const resource = voice.createAudioResource(stream, { inlineVolume: true });
    resource.volume.setVolume((cur.volume || 100) / 100);
    cur.player.play(resource);
  } catch (e) {
    logger.error('music', `無法播放「${track.title}」：${e.message}`);
    const cur = states.get(guildId);
    if (!cur || cur !== st || cur.playToken !== token) return;
    cur.failCount = (cur.failCount || 0) + 1;
    await _notifyChannel(client, cur, t(`❌ 無法播放此音訊：**${track.title}**`, `❌ Could not play this audio: **${track.title}**`));
    if (cur.failCount >= MAX_FAIL_COUNT) {
      await _notifyChannel(client, cur, t('❌ 連續播放失敗，已停止播放', '❌ Multiple playback failures, stopped playing'));
      _endPlayback(client, guildId);
      return;
    }
    _next(client, guildId); // 嘗試播下一首
  }
}

/** 解析 query：網址直接驗證，關鍵字搜尋取第一筆 */
async function _resolveTrack(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const isUrl = /^https?:\/\//i.test(q);

  if (!isUrl) {
    const results = await playdl.search(q, { limit: 5 });
    if (!Array.isArray(results) || results.length === 0) return null;
    const r = results[0];
    return {
      title: r.title || r.name || q,
      url: r.url || r.link || q,
      duration: (Number(r.durationInSec) || 0) * 1000,
    };
  }

  // YouTube 網址
  try {
    const kind = typeof playdl.yt_validate === 'function' ? playdl.yt_validate(q) : false;
    if (kind === 'video' || kind === 'playlist') {
      try {
        const info = await playdl.video_info(q);
        const vd = info && info.video_details;
        if (vd) {
          return {
            title: vd.title || t('YouTube 音訊', 'YouTube audio'),
            url: vd.url || q,
            duration: (Number(vd.durationInSec) || 0) * 1000,
          };
        }
      } catch (e) {
        /* 取不到詳細資訊仍嘗試播放 */
      }
      return { title: t('YouTube 音訊', 'YouTube audio'), url: q, duration: 0 };
    }
  } catch (e) {
    /* 忽略 */
  }

  // SoundCloud 網址
  try {
    const so = typeof playdl.so_validate === 'function' ? playdl.so_validate(q) : false;
    if (so) return { title: t('SoundCloud 音訊', 'SoundCloud audio'), url: q, duration: 0 };
  } catch (e) {
    /* 忽略 */
  }

  // 其他平台：直接嘗試播放（失敗會走錯誤處理）
  return { title: q, url: q, duration: 0 };
}

// ===== 對外指令函式 =====

/** /play：搜尋並播放，或加入佇列 */
async function play(client, interaction, query) {
  if (!(await _checkEnabled(interaction))) return;
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) return sendError(interaction, t('請先加入語音頻道', 'Please join a voice channel first'));

  const guildId = interaction.guildId;
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply().catch(() => {});
  }

  let state = states.get(guildId);
  if (!state) {
    state = createState(interaction.channelId);
    states.set(guildId, state);
  }
  state.textChannel = interaction.channelId;

  if (
    !state.connection ||
    state.connection.state.status === voice.VoiceConnectionStatus.Destroyed ||
    state.connection.state.status === voice.VoiceConnectionStatus.Disconnected
  ) {
    try {
      state.connection = voice.joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
    } catch (e) {
      logger.error('music', `加入語音頻道失敗（${guildId}）：${e.message}`);
      states.delete(guildId);
      return sendError(interaction, t('無法加入語音頻道，請確認機器人具有連線與發言權限', 'Could not join the voice channel — make sure the bot has connect and speak permissions'));
    }
  }
  _ensurePlayer(client, guildId);

  let track;
  try {
    track = await _resolveTrack(query);
  } catch (e) {
    logger.error('music', `搜尋音樂失敗（${guildId}）：${e.message}`);
    return sendError(interaction, t('搜尋音樂時發生錯誤，請稍後再試', 'An error occurred while searching for music, please try again later'));
  }
  if (!track) return sendError(interaction, t('找不到該音樂，請確認網址或關鍵字是否正確', 'Could not find that music — check the URL or keyword'));
  track.requestedBy = interaction.user?.tag || t('未知使用者', 'Unknown user');

  const wasPlaying = state.playing && state.queue.length > 0;
  state.queue.push(track);
  if (!wasPlaying) {
    state.currentIndex = state.queue.length - 1;
    _playTrack(client, guildId);
    return safeReply(interaction, { content: t(`▶️ 正在播放：**${track.title}**`, `▶️ Now playing: **${track.title}**`) });
  }
  return safeReply(interaction, { content: t(`📥 已加入佇列：**${track.title}**`, `📥 Added to queue: **${track.title}**`) });
}

/** /skip：停止目前播放並自動播下一首 */
async function skip(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st || !st.playing) return sendError(interaction, EMPTY_MSG());
  const current = st.queue[st.currentIndex];
  st.skipping = true;
  try {
    st.player.stop();
  } catch (e) {
    /* 忽略 */
  }
  _next(client, interaction.guildId, true);
  const nextTrack = st.queue[st.currentIndex];
  const msg = current
    ? t(
        `已跳過 **${current.title}**${nextTrack ? `，接下來播放 **${nextTrack.title}**` : '，佇列已結束'}`,
        `Skipped **${current.title}**${nextTrack ? `, now playing **${nextTrack.title}**` : ', queue ended'}`
      )
    : t('已跳過目前曲目', 'Skipped the current track');
  return sendSuccess(interaction, msg);
}

/** /stop：清空佇列、停止播放並離開頻道 */
async function stop(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = states.get(interaction.guildId);
  if (!st) return sendError(interaction, EMPTY_MSG());
  _leave(interaction.guildId);
  return sendSuccess(interaction, t('已停止播放並離開語音頻道', 'Stopped playback and left the voice channel'));
}

/** /pause：暫停播放 */
async function pause(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st || !st.playing) return sendError(interaction, EMPTY_MSG());
  if (st.player.state.status === voice.AudioPlayerStatus.Paused) {
    return sendError(interaction, t('音樂已經暫停', 'The music is already paused'));
  }
  try {
    st.player.pause();
  } catch (e) {
    return sendError(interaction, t('暫停失敗，請稍後再試', 'Failed to pause, please try again later'));
  }
  return sendSuccess(interaction, t('已暫停播放，使用 /resume 繼續播放', 'Paused — use /resume to continue'));
}

/** /resume：繼續播放 */
async function resume(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st) return sendError(interaction, EMPTY_MSG());
  if (st.player.state.status === voice.AudioPlayerStatus.Playing) {
    return sendError(interaction, t('音樂已在播放中', 'The music is already playing'));
  }
  if (st.player.state.status !== voice.AudioPlayerStatus.Paused) {
    return sendError(interaction, EMPTY_MSG());
  }
  try {
    st.player.unpause();
  } catch (e) {
    return sendError(interaction, t('恢復播放失敗，請稍後再試', 'Failed to resume, please try again later'));
  }
  return sendSuccess(interaction, t('已繼續播放', 'Resumed playing'));
}

/** /nowplaying：目前曲目資訊 */
async function nowplaying(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st || !st.playing) return sendError(interaction, EMPTY_MSG());
  const track = st.queue[st.currentIndex];
  const playback = st.player?.state?.playbackDuration || 0;
  const total = track.duration || 0;
  const embed = new EmbedBuilder()
    .setColor(Colors.MUSIC)
    .setTitle(t('🎵 目前播放', '🎵 Now Playing'))
    .setDescription(`**${track.title}**`)
    .addFields(
      { name: t('👤 請求者', '👤 Requested by'), value: track.requestedBy || t('未知', 'Unknown'), inline: true },
      { name: t('⏱️ 進度', '⏱️ Progress'), value: t(`${formatClock(playback)} / ${total > 0 ? formatClock(total) : '未知'}`, `${formatClock(playback)} / ${total > 0 ? formatClock(total) : 'Unknown'}`), inline: true },
      { name: t('🔁 循環', '🔁 Loop'), value: loopLabel(st.loop), inline: true }
    );
  withFooter(embed, client, t(`音量 ${st.volume}%`, `Volume ${st.volume}%`));
  return safeReply(interaction, { embeds: [embed] });
}

/** /queue：列出佇列前 10 首與總數 */
async function queueList(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st) return sendError(interaction, EMPTY_MSG());
  const start = st.playing ? st.currentIndex : 0;
  const end = Math.min(st.queue.length, start + 10);
  const lines = [];
  for (let i = start; i < end; i++) {
    const track = st.queue[i];
    const prefix = i === st.currentIndex && st.playing ? t('🎵 目前播放', '🎵 Now playing') : `\`${i + 1}\``;
    lines.push(`${prefix} **${track.title}** — ${formatClock(track.duration || 0)}`);
  }
  const remaining = Math.max(0, st.queue.length - end);
  const embed = new EmbedBuilder()
    .setColor(Colors.MUSIC)
    .setTitle(t('🎵 播放佇列', '🎵 Playback Queue'))
    .setDescription(lines.length ? lines.join('\n') : t('佇列是空的', 'The queue is empty'))
    .addFields(
      { name: t('📃 總曲目數', '📃 Total tracks'), value: String(st.queue.length), inline: true },
      { name: t('🔁 循環模式', '🔁 Loop mode'), value: loopLabel(st.loop), inline: true },
      { name: t('🔊 音量', '🔊 Volume'), value: `${st.volume}%`, inline: true }
    );
  if (remaining > 0) embed.setFooter({ text: t(`…還有 ${remaining} 首未顯示`, `…${remaining} more not shown`) });
  else withFooter(embed, client);
  return safeReply(interaction, { embeds: [embed] });
}

/** /loop：設定循環模式 */
async function loop(client, interaction, mode) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st) return sendError(interaction, EMPTY_MSG());
  const m = ['off', 'queue', 'one'].includes(mode) ? mode : 'off';
  st.loop = m;
  return sendSuccess(interaction, t(`循環模式已設為 **${loopLabel(m)}**`, `Loop mode set to **${loopLabel(m)}**`));
}

/** /shuffle：洗牌佇列（不含目前播放） */
async function shuffle(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st) return sendError(interaction, EMPTY_MSG());
  if (st.queue.length <= 1) return sendError(interaction, t('佇列中沒有足夠的曲目可以洗牌', 'Not enough tracks in the queue to shuffle'));
  const current = st.queue[st.currentIndex];
  const rest = st.queue.filter((_, i) => i !== st.currentIndex);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const newQueue = new Array(st.queue.length);
  newQueue[st.currentIndex] = current;
  let ri = 0;
  for (let i = 0; i < newQueue.length; i++) {
    if (i === st.currentIndex) continue;
    newQueue[i] = rest[ri++];
  }
  st.queue = newQueue;
  return sendSuccess(interaction, t('已將佇列洗牌（目前播放的曲目不變）', 'Queue shuffled (current track stays)'));
}

/** /volume：設定音量 0-100 */
async function volume(client, interaction, vol) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st) return sendError(interaction, EMPTY_MSG());
  const v = Math.max(0, Math.min(100, Math.round(Number(vol) || 0)));
  st.volume = v;
  try {
    const res = st.player?.state?.resource;
    if (res && res.volume) res.volume.setVolume(v / 100);
  } catch (e) {
    /* 忽略音量套用錯誤 */
  }
  return sendSuccess(interaction, t(`音量已設為 **${v}%**`, `Volume set to **${v}%**`));
}

/** /remove：移除佇列第 N 首 */
async function removeAt(client, interaction, index) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st) return sendError(interaction, EMPTY_MSG());
  const idx = Math.floor(Number(index)) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= st.queue.length) {
    return sendError(interaction, t('請輸入有效的佇列編號（可用 /queue 查看）', 'Please enter a valid queue number (use /queue)'));
  }
  if (idx === st.currentIndex && st.playing) {
    return sendError(interaction, t('無法移除目前正在播放的曲目，請先使用 /skip', 'Cannot remove the currently playing track — use /skip first'));
  }
  const [removed] = st.queue.splice(idx, 1);
  if (idx < st.currentIndex) st.currentIndex -= 1;
  return sendSuccess(interaction, t(`已從佇列移除：**${removed ? removed.title : '曲目'}**`, `Removed from queue: **${removed ? removed.title : 'track'}**`));
}

/** /clear：清空佇列（不離開頻道，保留目前播放） */
async function clear(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = _getActiveState(interaction.guildId);
  if (!st) return sendError(interaction, EMPTY_MSG());
  const removed = st.queue.length - 1;
  const current = st.queue[st.currentIndex];
  st.queue = current ? [current] : [];
  st.currentIndex = 0;
  const msg =
    removed > 0
      ? t(`已清空佇列，移除了 **${removed}** 首待播曲目`, `Queue cleared — removed **${removed}** upcoming track(s)`)
      : t('佇列中已沒有其他待播曲目', 'There are no other tracks in the queue');
  return sendSuccess(interaction, msg);
}

/** /join：加入使用者語音頻道 */
async function join(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) return sendError(interaction, t('請先加入語音頻道', 'Please join a voice channel first'));
  const guildId = interaction.guildId;
  let st = states.get(guildId);
  if (
    st &&
    st.connection &&
    st.connection.state.status !== voice.VoiceConnectionStatus.Destroyed &&
    st.connection.state.status !== voice.VoiceConnectionStatus.Disconnected
  ) {
    return sendSuccess(interaction, t(`機器人已在語音頻道 <#${st.connection.joinConfig.channelId}> 中`, `The bot is already in voice channel <#${st.connection.joinConfig.channelId}>`));
  }
  if (!st) {
    st = createState(interaction.channelId);
    states.set(guildId, st);
  }
  try {
    st.connection = voice.joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
  } catch (e) {
    logger.error('music', `加入語音頻道失敗（${guildId}）：${e.message}`);
    states.delete(guildId);
    return sendError(interaction, t('無法加入語音頻道，請確認機器人具有連線與發言權限', 'Could not join the voice channel — make sure the bot has connect and speak permissions'));
  }
  _ensurePlayer(client, guildId);
  return sendSuccess(interaction, t(`已加入語音頻道 <#${voiceChannel.id}>`, `Joined voice channel <#${voiceChannel.id}>`));
}

/** /leave：離開語音並清空 */
async function leave(client, interaction) {
  if (!(await _checkEnabled(interaction))) return;
  const st = states.get(interaction.guildId);
  if (!st || !st.connection) return sendError(interaction, t('機器人目前不在語音頻道中', 'The bot is not in a voice channel right now'));
  _leave(interaction.guildId);
  return sendSuccess(interaction, t('已離開語音頻道並清空播放佇列', 'Left the voice channel and cleared the queue'));
}

// ===== 事件處理 =====

/**
 * voiceStateUpdate：機器人所在頻道變空 → 60 秒後仍空才離開並清空佇列。
 * 機器人被中斷連線 → 立即清理。
 */
async function handleVoiceState(client, oldState, newState) {
  try {
    const guildId = newState.guild?.id || oldState.guild?.id;
    const botId = client.user?.id;
    if (!guildId || !botId) return;
    const st = states.get(guildId);
    if (!st) return;

    // 機器人被中斷連線（被踢出/移出/斷線）→ 立即清理
    if (oldState.member?.id === botId && oldState.channelId && !newState.channelId) {
      _leave(guildId);
      return;
    }

    // 檢查機器人所在語音頻道是否還有非機器人成員
    const channelId = st.connection?.joinConfig?.channelId;
    if (!channelId) return;
    const channel = client.channels.cache.get(channelId);
    let hasHuman = false;
    try {
      hasHuman = !!(channel && channel.members && channel.members.some((m) => !m.user.bot));
    } catch (e) {
      hasHuman = false;
    }

    if (hasHuman) {
      // 有人（重新）加入 → 取消待辦的離開
      if (st.leaveTimer) {
        clearTimeout(st.leaveTimer);
        st.leaveTimer = null;
      }
      return;
    }

    // 頻道空了 → 60 秒後若仍空才離開並清空佇列
    if (!st.leaveTimer) {
      st.leaveTimer = setTimeout(() => {
        const s = states.get(guildId);
        if (!s) return;
        s.leaveTimer = null;
        const ch = client.channels.cache.get(channelId);
        let human = false;
        try {
          human = !!(ch && ch.members && ch.members.some((m) => !m.user.bot));
        } catch (e) {
          human = false;
        }
        if (human) return; // 有人回來 → 不離開
        _leave(guildId); // 離開並清空佇列
      }, LEAVE_DELAY_MS);
    }
  } catch (e) {
    logger.error('music', `handleVoiceState 錯誤：${e.message}`);
  }
}

/** ready：清掃所有 guild 狀態（重啟後無殘留連線） */
async function onReady(client) {
  for (const guildId of [...states.keys()]) {
    const st = states.get(guildId);
    if (st && st.leaveTimer) clearTimeout(st.leaveTimer);
    try {
      if (st && st.connection) st.connection.destroy();
    } catch (e) {
      /* 忽略 */
    }
    states.delete(guildId);
  }
  // 保險：清掉任何殘留的語音連線
  if (voice && typeof voice.getVoiceConnections === 'function') {
    for (const conn of [...voice.getVoiceConnections().values()]) {
      try {
        conn.destroy();
      } catch (e) {
        /* 忽略 */
      }
    }
  }
  logger.info('music', `音樂模組初始化完成（依賴=${enabled ? '正常' : '缺失'}，ffmpeg=${ffmpegOk ? '正常' : '缺失'}）`);
}

module.exports = {
  play,
  skip,
  stop,
  pause,
  resume,
  nowplaying,
  queueList,
  loop,
  shuffle,
  volume,
  removeAt,
  clear,
  join,
  leave,
  handleVoiceState,
  onReady,
};
