const { MessageFlags, SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendSuccess, sendError, withFooter } = require('../../utils/embeds');
const { requireBotPerm } = require('../../core/permissions');
const { t } = require('../../utils/i18n');

/** 可切換的日誌事件 */
const EVENT_LABELS = {
  messageEdit: t('訊息編輯', 'Message edit'),
  messageDelete: t('訊息刪除', 'Message delete'),
  memberJoin: t('成員加入', 'Member join'),
  memberLeave: t('成員離開', 'Member leave'),
  memberUpdate: t('成員更新（身分組/暱稱）', 'Member update (roles/nickname)'),
  channelCreate: t('頻道建立', 'Channel created'),
  channelDelete: t('頻道刪除', 'Channel deleted'),
  roleCreate: t('身分組建立', 'Role created'),
  roleDelete: t('身分組刪除', 'Role deleted'),
  ban: t('封鎖', 'Ban'),
  unban: t('解除封鎖', 'Unban'),
  voice: t('語音活動', 'Voice activity'),
};

module.exports = {
  category: 'config',
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription(t('設定審計日誌頻道', 'Set up audit log channel'))
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription(t('啟用日誌並設定頻道', 'Enable logging and set the channel'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('日誌頻道', 'Log channel')).addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('disable').setDescription(t('停用日誌', 'Disable logging')))
    .addSubcommand((sub) => sub.setName('status').setDescription(t('查看日誌設定', 'View logging settings')))
    .addSubcommand((sub) =>
      sub
        .setName('event')
        .setDescription(t('開啟/關閉特定事件的日誌', 'Toggle logging for a specific event'))
        .addStringOption((o) =>
          o
            .setName('event')
            .setDescription(t('要設定的日誌事件', 'Log event to configure'))
            .setRequired(true)
            .addChoices(
              ...Object.entries(EVENT_LABELS).map(([value, name]) => ({ name, value }))
            )
        )
        .addBooleanOption((o) => o.setName('enabled').setDescription(t('開啟或關閉', 'Enable or disable')).setRequired(true))
    ),
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    try {
      if (sub === 'setup') {
        const channel = interaction.options.getChannel('channel');
        if (!(await requireBotPerm(interaction, PermissionFlagsBits.SendMessages, t('機器人缺少在該頻道發送訊息的權限。', 'The bot lacks permission to send messages in that channel.')))) return;
        await client.settings.set(guildId, 'logs.enabled', true);
        await client.settings.set(guildId, 'logs.channel', channel.id);
        await sendSuccess(interaction, t(`審計日誌已啟用，將記錄到 <#${channel.id}>。\n可用 \`/logging event\` 調整各事件的開關。`, `Audit logging enabled — will log to <#${channel.id}>.\nUse \`/logging event\` to toggle each event.`));
      } else if (sub === 'disable') {
        await client.settings.set(guildId, 'logs.enabled', false);
        await sendSuccess(interaction, t('審計日誌已停用。', 'Audit logging disabled.'));
      } else if (sub === 'status') {
        const s = (await client.settings.get(guildId)).logs || {};
        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(t('📋 審計日誌設定', '📋 Audit Log Settings'))
          .addFields(
            { name: t('狀態', 'Status'), value: s.enabled ? t('✅ 已啟用', '✅ Enabled') : t('❌ 已停用', '❌ Disabled'), inline: true },
            { name: t('頻道', 'Channel'), value: s.channel ? `<#${s.channel}>` : t('未設定', 'Not set'), inline: true }
          )
          .addFields(
            Object.entries(EVENT_LABELS).map(([key, label]) => ({
              name: label,
              value: s.events?.[key] === false ? t('❌ 關閉', '❌ Off') : t('✅ 開啟', '✅ On'),
              inline: true,
            }))
          );
        withFooter(embed, client);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (sub === 'event') {
        const event = interaction.options.getString('event');
        const enabled = interaction.options.getBoolean('enabled');
        await client.settings.set(guildId, `logs.events.${event}`, enabled);
        await sendSuccess(interaction, t(`已${enabled ? '開啟' : '關閉'}「${EVENT_LABELS[event]}」日誌。`, `${enabled ? 'Enabled' : 'Disabled'} "${EVENT_LABELS[event]}" logging.`));
      }
    } catch (e) {
      await sendError(interaction, t(`執行失敗：${e.message || '未知錯誤'}`, `Execution failed: ${e.message || 'Unknown error'}`));
    }
  },
};
