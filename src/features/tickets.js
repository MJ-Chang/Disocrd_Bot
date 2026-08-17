const fs = require('fs');
const path = require('path');
const { MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
} = require('discord.js');
const { Colors } = require('../utils/constants');
const { info, success, sendError, sendSuccess, withFooter } = require('../utils/embeds');
const { formatDuration } = require('../utils/format');
const { isModerator } = require('../core/permissions');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

/** customId 前綴 */
const PREFIX = 'ticket:';

/** 統一解析「角色/頻道物件或 ID 字串」 */
function resId(x) {
  if (typeof x === 'string') return x;
  return (x && x.id) || null;
}

/** 移除頻道名稱中的特殊字元並限制長度 */
function sanitizeName(name, max = 16) {
  const clean = String(name || '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '')
    .slice(0, max);
  return clean || 'ticket';
}

/** 建立客服單歡迎訊息的按鈕列（關閉 / 認領 / 轉錄 / 刪除） */
function welcomeComponents() {
  const close = new ButtonBuilder()
    .setCustomId('ticket:close')
    .setLabel(t('🔒 關閉', '🔒 Close'))
    .setStyle(ButtonStyle.Danger);
  const claim = new ButtonBuilder()
    .setCustomId('ticket:claim')
    .setLabel(t('🙋 認領', '🙋 Claim'))
    .setStyle(ButtonStyle.Primary);
  const transcript = new ButtonBuilder()
    .setCustomId('ticket:transcript')
    .setLabel(t('📄 轉錄', '📄 Transcript'))
    .setStyle(ButtonStyle.Secondary);
  const del = new ButtonBuilder()
    .setCustomId('ticket:delete')
    .setLabel(t('🗑️ 刪除', '🗑️ Delete'))
    .setStyle(ButtonStyle.Danger);
  return [new ActionRowBuilder().addComponents(close, claim, transcript, del)];
}

/** 將既有 ActionRow 資料轉為「全部按鈕停用」的新 ActionRow 陣列 */
function disableRows(rows) {
  return rows.map((row) => {
    const raw = row.data || row;
    const components = Array.isArray(raw.components) ? raw.components : [];
    return new ActionRowBuilder({
      components: components.map((c) => ButtonBuilder.from(c).setDisabled(true)),
    });
  });
}

/** 在客服單頻道中尋找機器人發送的歡迎訊息（含 ticket:close 按鈕） */
async function findWelcomeMessage(client, channel) {
  const messages = await channel.messages.fetch({ limit: 20 });
  return (
    [...messages.values()].find(
      (m) =>
        m.author.id === client.user.id &&
        m.components.some((r) => r.components.some((b) => b.customId === 'ticket:close'))
    ) || null
  );
}

/** 建立客服面板 Embed */
function buildPanelEmbed(client) {
  const embed = new EmbedBuilder()
    .setColor(Colors.TICKET)
    .setTitle(t('🎫 客服支援', '🎫 Support'))
    .setDescription(t('需要協助嗎？點擊下方按鈕建立客服單，我們會盡快回覆你！', 'Need help? Click the button below to open a ticket. We will reply as soon as possible!'))
    .addFields(
      { name: t('📌 注意事項', '📌 Notes'), value: t('請詳述你的問題，以便我們能更快速地為你服務。', 'Please describe your issue in detail so we can help you faster.') },
      { name: t('⏰ 回應時間', '⏰ Response time'), value: t('送出客服單後，請耐心等候支援人員的回應。', 'After opening a ticket, please wait for a support member to respond.') }
    );
  withFooter(embed, client);
  return embed;
}

/** 建立「建立客服單」按鈕列 */
function buildOpenRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:open').setLabel(t('🎫 建立客服單', '🎫 Open a Ticket')).setStyle(ButtonStyle.Primary)
  );
}

/**
 * 設定客服表單：發送面板 + 寫入設定
 */
async function setup(client, guild, channel, category, supportRole, transcriptChannel, maxTickets) {
  const panel = await channel.send({ embeds: [buildPanelEmbed(client)], components: [buildOpenRow()] });

  await client.settings.set(guild.id, 'tickets.enabled', true);
  await client.settings.set(guild.id, 'tickets.channel', resId(channel));
  await client.settings.set(guild.id, 'tickets.category', resId(category));
  await client.settings.set(guild.id, 'tickets.supportRole', resId(supportRole));
  await client.settings.set(guild.id, 'tickets.transcriptChannel', resId(transcriptChannel));
  if (Number.isInteger(maxTickets) && maxTickets > 0) {
    await client.settings.set(guild.id, 'tickets.maxTickets', maxTickets);
  }
  await client.settings.set(guild.id, 'tickets.panelMessage', panel.id);
  return panel;
}

/**
 * 依設定中心儲存的設定發送/更新客服面板（供網頁控制面板使用）
 * @returns {Promise<{ok: boolean, error?: string, message?: string}>}
 */
async function deploy(client, guild) {
  const cfg = (await client.settings.get(guild.id)).tickets || {};
  if (!cfg.enabled || !cfg.channel || !cfg.category) {
    return { ok: false, error: t('請先在設定中心勾選「客服表單」、選擇面板頻道與客服分類，並儲存。', "Enable 'Tickets', pick the panel channel and category in the settings center, then save.") };
  }
  const channel = guild.channels.cache.get(cfg.channel);
  const category = guild.channels.cache.get(cfg.category);
  if (!channel || !channel.isTextBased()) return { ok: false, error: t('找不到面板頻道（可能已被刪除），請重新選擇。', 'Panel channel not found (deleted?). Please pick it again.') };
  if (!category) return { ok: false, error: t('找不到客服分類（可能已被刪除），請重新選擇。', 'Ticket category not found (deleted?). Please pick it again.') };

  if (cfg.panelMessage) {
    const existing = await channel.messages.fetch(cfg.panelMessage).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [buildPanelEmbed(client)], components: [buildOpenRow()] });
      return { ok: true, message: t(`已更新 <#${channel.id}> 的既有客服面板。`, `Updated the existing ticket panel in <#${channel.id}>.`) };
    }
  }
  await setup(client, guild, channel, category, cfg.supportRole, cfg.transcriptChannel, cfg.maxTickets);
  return { ok: true, message: t(`✅ 已發送客服面板到 <#${channel.id}>。`, `✅ Ticket panel sent to <#${channel.id}>.`) };
}

/**
 * 開啟新的客服單
 * @param {object} client
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User} user
 * @param {import('discord.js').TextChannel} targetChannel 面板所在頻道
 * @param {import('discord.js').Interaction} [interaction] 用於回覆錯誤訊息
 * @returns {Promise<import('discord.js').TextChannel|null>}
 */
async function openTicket(client, guild, user, targetChannel, interaction) {
  const s = await client.settings.get(guild.id);
  const cfg = s.tickets || {};

  if (!cfg.enabled) {
    if (interaction) await sendError(interaction, t('客服表單系統尚未啟用。', 'The ticket system is not enabled.'));
    return null;
  }
  if (!cfg.category || !guild.channels.cache.has(cfg.category)) {
    if (interaction) await sendError(interaction, t('客服單分類尚未設定或已不存在，請聯絡管理員。', 'The ticket category is not set or no longer exists. Please contact an admin.'));
    return null;
  }

  const col = client.db.collection('tickets');
  const openCount = col.filter((x) => x.guildId === guild.id && x.userId === user.id && !x.closed).length;
  const maxTickets = cfg.maxTickets || 3;
  if (openCount >= maxTickets) {
    if (interaction) {
      await sendError(
        interaction,
        t(
          `你目前已有 ${openCount} 個未關閉的客服單（上限 ${maxTickets} 個），請先關閉舊的客服單再開新的。`,
          `You already have ${openCount} open tickets (max ${maxTickets}). Please close an old ticket first.`
        )
      );
    }
    return null;
  }

  const category = guild.channels.cache.get(cfg.category);
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];
  if (cfg.supportRole && guild.roles.cache.has(cfg.supportRole)) {
    overwrites.push({
      id: cfg.supportRole,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: `ticket-${sanitizeName(user.username, 16)}`,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: overwrites,
    topic: t(`🎫 ${user.tag} 的客服單（${user.id}）`, `🎫 Ticket of ${user.tag} (${user.id})`),
  });

  col.set(channel.id, {
    guildId: guild.id,
    userId: user.id,
    openedAt: Date.now(),
    closed: false,
    closedAt: null,
  });

  const welcome = new EmbedBuilder()
    .setColor(Colors.TICKET)
    .setTitle(t('🎫 客服單已建立', '🎫 Ticket Created'))
    .setDescription(
      cfg.welcomeMessage ||
        t(
          '你的客服單已建立！支援人員將很快回應，請耐心等候。\n請在此頻道詳述你的問題，我們會盡快協助你。',
          'Your ticket has been created! A support member will respond soon.\nPlease describe your issue in this channel.'
        )
    )
    .addFields(
      { name: t('👤 開單用戶', '👤 Opened by'), value: user.toString(), inline: true },
      { name: t('🆔 客服單 ID', '🆔 Ticket ID'), value: channel.id, inline: true }
    );
  withFooter(welcome, client);

  await channel.send({ content: `👋 <@${user.id}>`, embeds: [welcome], components: welcomeComponents() });

  if (interaction) {
    await sendSuccess(interaction, t(`客服單已建立：${channel}`, `Ticket created: ${channel}`));
  }
  return channel;
}

/**
 * 關閉客服單：鎖定頻道、停用按鈕、排程刪除
 */
async function closeTicket(client, interaction, targetChannel) {
  const channel = targetChannel || interaction.channel;
  const guild = interaction.guild;
  if (!channel || !channel.isTextBased()) {
    await sendError(interaction, t('請在客服單頻道中使用此功能。', 'Please use this in a ticket channel.'));
    return null;
  }

  const col = client.db.collection('tickets');
  const record = col.get(channel.id);
  if (!record) {
    await sendError(interaction, t('此頻道不是有效的客服單。', 'This channel is not a valid ticket.'));
    return null;
  }
  if (record.closed) {
    await sendError(interaction, t('此客服單已經關閉。', 'This ticket is already closed.'));
    return null;
  }

  // 鎖定頻道（@everyone 與開單用戶無法再發言）
  await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {});
  if (record.userId) {
    await channel.permissionOverwrites.edit(record.userId, { SendMessages: false }).catch(() => {});
  }

  // 更新資料庫
  col.update(channel.id, (cur) => ({ ...cur, closed: true, closedAt: Date.now() }));

  // 停用歡迎訊息上的按鈕
  let updated = false;
  if (interaction.isButton && interaction.isButton() && interaction.message) {
    try {
      await interaction.update({ components: disableRows(interaction.message.components) });
      updated = true;
    } catch (e) {
      logger.warn('tickets', `停用按鈕失敗（互動更新）：${e.message}`);
    }
  }
  if (!updated) {
    try {
      const welcome = await findWelcomeMessage(client, channel);
      if (welcome) await welcome.edit({ components: disableRows(welcome.components) }).catch(() => {});
    } catch (e) {
      logger.warn('tickets', `停用按鈕失敗（訊息編輯）：${e.message}`);
    }
  }

  // 排程刪除頻道
  const s = await client.settings.get(guild.id);
  const delay = s.tickets && s.tickets.closeDeleteAfter ? s.tickets.closeDeleteAfter : 3600000;
  setTimeout(() => {
    channel.delete(t('客服單已關閉，自動刪除', 'Ticket closed, auto-deleting')).catch(() => {});
  }, delay);

  await sendSuccess(interaction, t(`客服單已關閉，此頻道將於 ${formatDuration(delay)} 後自動刪除。`, `Ticket closed. This channel will be deleted in ${formatDuration(delay)}.`));
  return channel;
}

/**
 * 認領客服單（僅限管理人員）
 */
async function claimTicket(client, interaction, targetChannel) {
  const channel = targetChannel || interaction.channel;
  if (!isModerator(interaction.member)) {
    await sendError(interaction, t('只有管理人員可以認領客服單。', 'Only moderators can claim a ticket.'));
    return null;
  }
  const record = client.db.collection('tickets').get(channel.id);
  if (!record) {
    await sendError(interaction, t('此頻道不是有效的客服單。', 'This channel is not a valid ticket.'));
    return null;
  }

  const text = t(`🔒 此客服單已由 <@${interaction.user.id}> 認領`, `🔒 This ticket has been claimed by <@${interaction.user.id}>`);

  if (interaction.isButton && interaction.isButton() && interaction.message) {
    try {
      await interaction.update({ content: text });
      await sendSuccess(interaction, t('你已認領此客服單。', 'You claimed this ticket.'));
      return channel;
    } catch (e) {
      logger.warn('tickets', `認領更新失敗，改為編輯訊息：${e.message}`);
    }
  }

  try {
    const welcome = await findWelcomeMessage(client, channel);
    if (welcome) await welcome.edit({ content: text }).catch(() => {});
  } catch (e) {
    /* ignore */
  }
  await sendSuccess(interaction, t('你已認領此客服單。', 'You claimed this ticket.'));
  return channel;
}

/**
 * 產生客服單轉錄：收集訊息、寫入 Markdown、發送到轉錄頻道或回覆給使用者
 */
async function createTranscript(client, interaction, targetChannel) {
  const channel = targetChannel || interaction.channel;
  const guild = interaction.guild;
  const record = client.db.collection('tickets').get(channel.id);
  if (!record) {
    await sendError(interaction, '此頻道不是有效的客服單。');
    return null;
  }

  // 收集頻道內所有訊息
  const messages = [];
  let lastId = null;
  while (true) {
    const opts = { limit: 100 };
    if (lastId) opts.before = lastId;
    const batch = await channel.messages.fetch(opts);
    if (batch.size === 0) break;
    messages.push(...batch.values());
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  // 組成 Markdown
  const lines = [];
  lines.push(`# ${t('客服單轉錄', 'Ticket Transcript')}：${channel.name}`);
  lines.push(`- ${t('開單用戶', 'Opened by')}：<@${record.userId}>（${record.userId}）`);
  lines.push(`- ${t('開單時間', 'Opened at')}：${new Date(record.openedAt || Date.now()).toLocaleString('zh-TW')}`);
  lines.push(`- ${t('轉錄時間', 'Transcript at')}：${new Date().toLocaleString('zh-TW')}`);
  lines.push('');
  for (const m of messages) {
    const time = new Date(m.createdTimestamp).toLocaleString('zh-TW');
    const author = m.author ? `${m.author.tag}（${m.author.id}）` : t('未知使用者', 'Unknown user');
    lines.push(`## ${time} — ${author}`);
    if (m.content) lines.push(m.content);
    for (const att of m.attachments.values()) {
      lines.push(`- ${t('附件', 'Attachment')}：${att.url}`);
    }
    lines.push('');
  }

  // 寫入 data/transcripts/
  const dataDir = client.config && client.config.dataDir ? client.config.dataDir : path.join(__dirname, '..', '..', 'data');
  const dir = path.join(dataDir, 'transcripts');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `transcript-${channel.name}-${Date.now()}.md`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

  const attachment = new AttachmentBuilder(filePath);

  const s = await client.settings.get(guild.id);
  const transcriptChannelId = s.tickets && s.tickets.transcriptChannel ? s.tickets.transcriptChannel : null;
  const transcriptChannel = transcriptChannelId ? guild.channels.cache.get(transcriptChannelId) : null;

  if (transcriptChannel) {
    await transcriptChannel.send({
      content: t(`📄 客服單 **${channel.name}** 的轉錄已產生：`, `📄 Transcript for ticket **${channel.name}**:`),
      files: [attachment],
    });
    await sendSuccess(interaction, t(`轉錄已產生，並已發送到轉錄頻道 ${transcriptChannel}。`, `Transcript created and sent to ${transcriptChannel}.`));
  } else {
    const payload = {
      embeds: [success(t('✅ 完成', '✅ Done'), t('此客服單未設定轉錄頻道，以下為轉錄檔案。', 'No transcript channel is set; here is the transcript file.'))],
      files: [attachment],
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  }
  return filePath;
}

/** 按鈕分派 */
async function handleButton(client, interaction) {
  const id = interaction.customId || '';
  if (!id.startsWith(PREFIX)) return false;
  try {
    const guild = interaction.guild;
    const member = interaction.member;

    if (id === 'ticket:open') {
      await openTicket(client, guild, interaction.user, interaction.channel, interaction);
      return true;
    }

    if (id === 'ticket:close') {
      const record = client.db.collection('tickets').get(interaction.channel.id);
      const isOpener = !!(record && record.userId === interaction.user.id);
      if (!isOpener && !isModerator(member)) {
        await sendError(interaction, t('只有開單用戶或管理人員可以關閉客服單。', 'Only the ticket owner or moderators can close this ticket.'));
        return true;
      }
      await closeTicket(client, interaction);
      return true;
    }

    if (id === 'ticket:claim') {
      await claimTicket(client, interaction);
      return true;
    }

    if (id === 'ticket:transcript') {
      await createTranscript(client, interaction);
      return true;
    }

    if (id === 'ticket:delete') {
      if (!isModerator(member)) {
        await sendError(interaction, t('只有管理人員可以刪除客服單。', 'Only moderators can delete a ticket.'));
        return true;
      }
      await interaction.reply({ content: t('🗑️ 正在刪除客服單…', '🗑️ Deleting ticket…'), flags: MessageFlags.Ephemeral }).catch(() => {});
      const col = client.db.collection('tickets');
      col.delete(interaction.channel.id);
      await interaction.channel.delete(t('客服單已刪除', 'Ticket deleted')).catch(() => {});
      return true;
    }

    return true;
  } catch (e) {
    logger.error('tickets', `handleButton 錯誤：${e.stack || e.message}`);
    try {
      await sendError(interaction, t('執行客服操作時發生錯誤，請稍後再試。', 'An error occurred. Please try again later.'));
    } catch (e2) {
      /* ignore */
    }
    return true;
  }
}

/** Modal 分派（支援 ticket:rename） */
async function handleModal(client, interaction) {
  const id = interaction.customId || '';
  if (!id.startsWith(PREFIX)) return false;
  try {
    if (id === 'ticket:rename') {
      const name = interaction.fields.getTextInputValue('ticket_name');
      const clean = sanitizeName(name, 100);
      if (!clean || clean === 'ticket') {
        await sendError(interaction, t('頻道名稱無效。', 'Invalid channel name.'));
        return true;
      }
      await interaction.channel.setName(clean);
      await sendSuccess(interaction, t(`客服單頻道已重新命名為 **${clean}**。`, `Ticket channel renamed to **${clean}**.`));
      return true;
    }
    return true;
  } catch (e) {
    logger.error('tickets', `handleModal 錯誤：${e.stack || e.message}`);
    try {
      await sendError(interaction, t('處理表單時發生錯誤。', 'An error occurred while processing the form.'));
    } catch (e2) {
      /* ignore */
    }
    return true;
  }
}

/** 開機初始化：清除不存在伺服器的客服紀錄 */
async function onReady(client) {
  const col = client.db.collection('tickets');
  for (const entry of col.all()) {
    try {
      if (!client.guilds.cache.has(entry.guildId)) {
        col.delete(entry.id);
        logger.info('tickets', `已清除不存在的伺服器客服紀錄：${entry.id}`);
      }
    } catch (e) {
      logger.warn('tickets', `onReady 處理 ${entry.id} 失敗：${e.message}`);
    }
  }
}

module.exports = {
  setup,
  deploy,
  openTicket,
  closeTicket,
  claimTicket,
  createTranscript,
  handleButton,
  handleModal,
  onReady,
  sanitizeName,
};
