const { MessageFlags, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { logger } = require('../utils/logger');
const { Colors } = require('../utils/constants');
const { isModerator } = require('../core/permissions');
const { t } = require('../utils/i18n');

/**
 * 臨時語音頻道：使用者加入指定「建立頻道」後自動生成私人語音頻道，
 * 並透過控制面板管理（改名、人數上限、鎖定、允許成員、踢出、刪除）。
 * customId 前綴：tv:
 */
const CHANNELS = new Map(); // channelId -> { guildId, ownerId }

function sanitizeName(name) {
  return String(name).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\- ]/g, '').trim().slice(0, 32) || t('語音頻道', 'Voice Channel');
}

async function createChannel(client, guild, member, template) {
  const s = (await client.settings.get(guild.id)).tempVoice;
  if (!s || !s.enabled) return null;

  const name = template.replace('{user}', member.user.username);
  const channel = await guild.channels.create({
    name: sanitizeName(name),
    type: ChannelType.GuildVoice,
    parent: s.category || undefined,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        deny: [PermissionFlagsBits.ManageChannels],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.Stream,
          PermissionFlagsBits.UseVAD,
        ],
      },
      {
        id: client.user.id,
        allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      },
    ],
  });

  CHANNELS.set(channel.id, { guildId: guild.id, ownerId: member.id });
  client.db.collection('tempVoice').set(channel.id, { guildId: guild.id, ownerId: member.id, createdAt: Date.now() });

  await member.voice.setChannel(channel.id).catch(() => {});

  // 控制面板
  const embed = {
    color: Colors.INFO,
    title: t('🔊 頻道控制面板', '🔊 Channel Control Panel'),
    description: t(`你是 **${channel.name}** 的擁有者，可以使用下方按鈕管理頻道。`, `You own **${channel.name}** — use the buttons below to manage it.`),
    timestamp: new Date(),
  };
  const panel = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv:rename').setLabel(t('改名', 'Rename')).setStyle(ButtonStyle.Primary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId('tv:limit').setLabel(t('人數上限', 'User Limit')).setStyle(ButtonStyle.Primary).setEmoji('🔢'),
    new ButtonBuilder().setCustomId('tv:lock').setLabel(t('鎖定', 'Lock')).setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('tv:unlock').setLabel(t('解鎖', 'Unlock')).setStyle(ButtonStyle.Success).setEmoji('🔓'),
    new ButtonBuilder().setCustomId('tv:delete').setLabel(t('刪除', 'Delete')).setStyle(ButtonStyle.Danger).setEmoji('🗑️')
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv:permit').setLabel(t('允許成員', 'Allow Member')).setStyle(ButtonStyle.Success).setEmoji('➕'),
    new ButtonBuilder().setCustomId('tv:kick').setLabel(t('踢出成員', 'Kick Member')).setStyle(ButtonStyle.Danger).setEmoji('🚪')
  );
  await channel.send({ embeds: [embed], components: [panel, row2] }).catch(() => {});
  return channel;
}

async function deleteChannel(client, channelId) {
  const ch = client.channels.cache.get(channelId);
  if (ch && ch.deletable) await ch.delete().catch(() => {});
  CHANNELS.delete(channelId);
  client.db.collection('tempVoice').delete(channelId);
}

/** 檢查空頻道並清理 */
async function cleanupEmpty(client, channelId) {
  const ch = client.channels.cache.get(channelId);
  if (!ch) {
    CHANNELS.delete(channelId);
    client.db.collection('tempVoice').delete(channelId);
    return;
  }
  if (ch.members.size === 0) await deleteChannel(client, channelId);
}

async function handleVoiceState(client, oldState, newState) {
  try {
    // 加入建立頻道 → 生成臨時頻道
    if (newState.channelId && newState.member && !newState.member.user.bot) {
      const s = (await client.settings.get(newState.guild.id)).tempVoice;
      if (s?.enabled && s.createChannel && newState.channelId === s.createChannel) {
        await createChannel(client, newState.guild, newState.member, s.nameTemplate || '🔊 {user} 的頻道');
      }
    }
    // 離開臨時頻道 → 若為空則刪除
    if (oldState.channelId && CHANNELS.has(oldState.channelId)) {
      setTimeout(() => cleanupEmpty(client, oldState.channelId), 5000);
    }
  } catch (e) {
    logger.error('tempVoice', `voiceStateUpdate 失敗：${e.message}`);
  }
}

/** 檢查是否為頻道擁有者或管理人員 */
function canManage(guildId, channelId, member) {
  if (isModerator(member)) return true;
  const record = CHANNELS.get(channelId);
  return record && record.guildId === guildId && record.ownerId === member.id;
}

async function handleButton(client, interaction) {
  const { customId } = interaction;
  if (!customId.startsWith('tv:')) return false;
  const channel = interaction.channel;
  if (!channel || !CHANNELS.has(channel.id)) {
    await interaction.reply({ content: t('❌ 此頻道已不是臨時語音頻道。', '❌ This channel is no longer a temp voice channel.'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  if (!canManage(interaction.guild.id, channel.id, interaction.member)) {
    await interaction.reply({ content: t('❌ 只有頻道擁有者或管理人員可以操作。', '❌ Only the channel owner or moderators can do this.'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  switch (customId) {
    case 'tv:rename': {
      const modal = new ModalBuilder()
        .setCustomId('tv:rename-modal')
        .setTitle(t('改名頻道', 'Rename Channel'))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('tv_name').setLabel(t('新名稱', 'New name')).setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(true)
          )
        );
      await interaction.showModal(modal).catch(() => {});
      return true;
    }
    case 'tv:limit': {
      const modal = new ModalBuilder()
        .setCustomId('tv:limit-modal')
        .setTitle(t('設定人數上限', 'Set User Limit'))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('tv_limit').setLabel(t('人數上限（0 = 無限制）', 'User limit (0 = unlimited)')).setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true)
          )
        );
      await interaction.showModal(modal).catch(() => {});
      return true;
    }
    case 'tv:lock': {
      await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false }).catch(() => {});
      await interaction.reply({ content: t('🔒 頻道已鎖定，只有你與管理人員可以加入。', '🔒 Channel locked — only you and moderators can join.'), flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    case 'tv:unlock': {
      await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: true }).catch(() => {});
      await interaction.reply({ content: t('🔓 頻道已解鎖。', '🔓 Channel unlocked.'), flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    case 'tv:delete': {
      await interaction.reply({ content: t('🗑️ 正在刪除頻道…', '🗑️ Deleting channel…'), flags: MessageFlags.Ephemeral }).catch(() => {});
      await deleteChannel(client, channel.id);
      return true;
    }
    case 'tv:permit':
    case 'tv:kick': {
      const members = channel.members.filter((m) => !m.user.bot);
      if (members.size === 0) {
        await interaction.reply({ content: t('❌ 頻道內目前沒有其他成員。', '❌ No other members are in the channel.'), flags: MessageFlags.Ephemeral }).catch(() => {});
        return true;
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId(customId === 'tv:permit' ? 'tv:permit-select' : 'tv:kick-select')
        .setPlaceholder(customId === 'tv:permit' ? t('選擇要允許的成員', 'Select members to allow') : t('選擇要踢出的成員', 'Select members to kick'))
        .setMinValues(1)
        .setMaxValues(Math.min(members.size, 25))
        .addOptions(
          members.map((m) => ({
            label: m.user.username,
            value: m.id,
            description: m.displayName.slice(0, 60),
          }))
        );
      await interaction.reply({ content: customId === 'tv:permit' ? t('選擇要允許加入的成員：', 'Select members to allow:') : t('選擇要踢出的成員：', 'Select members to kick:'), components: [new ActionRowBuilder().addComponents(select)], flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    default:
      return true;
  }
}

async function handleSelectMenu(client, interaction) {
  const { customId, values } = interaction;
  const channel = interaction.channel;
  if (!channel || !CHANNELS.has(channel.id)) {
    await interaction.reply({ content: t('❌ 此頻道已不是臨時語音頻道。', '❌ This channel is no longer a temp voice channel.'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  if (customId === 'tv:permit-select') {
    for (const id of values) {
      await channel.permissionOverwrites.edit(id, { Connect: true, Speak: true }).catch(() => {});
    }
    await interaction.update({ content: t(`✅ 已允許 ${values.length} 位成員加入。`, `✅ Allowed ${values.length} member(s) to join.`), components: [] }).catch(() => {});
    return true;
  }
  if (customId === 'tv:kick-select') {
    for (const id of values) {
      const member = channel.guild.members.cache.get(id);
      if (member?.voice?.channelId === channel.id) await member.voice.disconnect().catch(() => {});
    }
    await interaction.update({ content: t(`🚪 已踢出 ${values.length} 位成員。`, `🚪 Kicked ${values.length} member(s).`), components: [] }).catch(() => {});
    return true;
  }
  return false;
}

async function handleModal(client, interaction) {
  const { customId } = interaction;
  const channel = interaction.channel;
  if (!channel || !CHANNELS.has(channel.id)) {
    await interaction.reply({ content: t('❌ 此頻道已不是臨時語音頻道。', '❌ This channel is no longer a temp voice channel.'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  if (customId === 'tv:rename-modal') {
    const name = interaction.fields.getTextInputValue('tv_name');
    await channel.setName(sanitizeName(name)).catch(() => {});
    await interaction.reply({ content: t(`✏️ 頻道已改名為 **${sanitizeName(name)}**。`, `✏️ Channel renamed to **${sanitizeName(name)}**.`), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  if (customId === 'tv:limit-modal') {
    const raw = interaction.fields.getTextInputValue('tv_limit');
    const limit = Math.max(0, Math.min(99, parseInt(raw, 10) || 0));
    await channel.setUserLimit(limit).catch(() => {});
    await interaction.reply({ content: limit === 0 ? t('🔢 人數上限已設為無限制。', '🔢 User limit set to unlimited.') : t(`🔢 人數上限已設為 **${limit}**。`, `🔢 User limit set to **${limit}**.`), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  return false;
}

async function onReady(client) {
  // 清理重啟後已不存在的頻道紀錄
  const col = client.db.collection('tempVoice');
  for (const record of col.all()) {
    const ch = client.channels.cache.get(record.id);
    if (!ch) {
      col.delete(record.id);
      CHANNELS.delete(record.id);
    } else {
      CHANNELS.set(record.id, { guildId: record.guildId, ownerId: record.ownerId });
    }
  }
}

module.exports = { handleVoiceState, handleButton, handleSelectMenu, handleModal, onReady };
