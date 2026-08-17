const { MessageFlags, SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendSuccess, sendError, withFooter } = require('../../utils/embeds');
const { requireBotPerm } = require('../../core/permissions');
const { t } = require('../../utils/i18n');
const welcome = require('../../features/welcome');

const { DEFAULT_WELCOME, DEFAULT_GOODBYE } = welcome;

/** 選單說明：支援的變數（用於 /welcome status 與幫助文字） */
const VARS_HINT = t('支援變數：{user} {mention} {tag} {guild} {count}', 'Variables: {user} {mention} {tag} {guild} {count}');

module.exports = {
  category: 'config',
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription(t('設定歡迎／歡送訊息', 'Set up welcome / goodbye messages'))
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription(t('設定歡迎訊息', 'Set up the welcome message'))
        .addChannelOption((o) =>
          o.setName('channel').setDescription(t('發送歡迎訊息的頻道', 'Channel for welcome messages')).addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addStringOption((o) => o.setName('message').setDescription(t('歡迎訊息內容', 'Welcome message content')))
        .addBooleanOption((o) => o.setName('dm').setDescription(t('是否同時私訊新成員', 'Also DM new members')))
        .addStringOption((o) => o.setName('dm_message').setDescription(t('私訊內容', 'DM message content')))
    )
    .addSubcommand((sub) => sub.setName('test').setDescription(t('在目前頻道預覽歡迎訊息', 'Preview the welcome message here')))
    .addSubcommand((sub) => sub.setName('disable').setDescription(t('停用歡迎訊息', 'Disable welcome messages')))
    .addSubcommand((sub) => sub.setName('status').setDescription(t('查看歡迎／歡送設定狀態', 'View welcome / goodbye settings')))
    .addSubcommand((sub) =>
      sub
        .setName('goodbye-setup')
        .setDescription(t('設定歡送訊息', 'Set up the goodbye message'))
        .addChannelOption((o) =>
          o.setName('channel').setDescription(t('發送歡送訊息的頻道', 'Channel for goodbye messages')).addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addStringOption((o) => o.setName('message').setDescription(t('歡送訊息內容', 'Goodbye message content')))
    )
    .addSubcommand((sub) => sub.setName('goodbye-disable').setDescription(t('停用歡送訊息', 'Disable goodbye messages'))),
  adminOnly: true,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
        const dm = interaction.options.getBoolean('dm');
        const dmMessage = interaction.options.getString('dm_message');

        if (!(await requireBotPerm(interaction, PermissionFlagsBits.SendMessages, t('機器人缺少在該頻道發送訊息的權限。', 'The bot cannot send messages in that channel.')))) return;

        await client.settings.update(interaction.guildId, (s) => {
          s.welcome.enabled = true;
          s.welcome.channel = channel.id;
          if (message != null) s.welcome.message = message;
          if (dm != null) s.welcome.dm = dm;
          if (dmMessage != null) s.welcome.dmMessage = dmMessage;
        });
        await sendSuccess(
          interaction,
          t(
            `歡迎訊息已啟用，將在 <#${channel.id}> 發送。${dm ? '同時會私訊新成員。' : ''}`,
            `Welcome message enabled in <#${channel.id}>.${dm ? ' New members will also be DMed.' : ''}`
          )
        );
      } else if (sub === 'test') {
        const s = await client.settings.get(interaction.guildId);
        const text = welcome.renderTemplate(s.welcome?.message || DEFAULT_WELCOME(), interaction.member);
        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(t('🎉 歡迎加入！', '🎉 Welcome!'))
          .setDescription(text)
          .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));
        withFooter(embed, client, t('歡迎訊息預覽', 'Welcome message preview'));
        await interaction.reply({ embeds: [embed] });
      } else if (sub === 'disable') {
        await client.settings.set(interaction.guildId, 'welcome.enabled', false);
        await sendSuccess(interaction, t('歡迎訊息已停用。', 'Welcome messages disabled.'));
      } else if (sub === 'status') {
        const s = await client.settings.get(interaction.guildId);
        const w = s.welcome || {};
        const g = s.goodbye || {};
        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(t('⚙️ 歡迎／歡送設定', '⚙️ Welcome / Goodbye Settings'))
          .addFields(
            {
              name: t('🎉 歡迎訊息', '🎉 Welcome'),
              value: w.enabled
                ? `${t('✅ 已啟用', '✅ Enabled')}\n${t('頻道', 'Channel')}：${w.channel ? `<#${w.channel}>` : t('未設定', 'Not set')}\n${t('私訊', 'DM')}：${w.dm ? t('✅ 開啟', '✅ On') : t('❌ 關閉', '❌ Off')}`
                : t('❌ 已停用', '❌ Disabled'),
              inline: true,
            },
            {
              name: t('👋 歡送訊息', '👋 Goodbye'),
              value: g.enabled
                ? `${t('✅ 已啟用', '✅ Enabled')}\n${t('頻道', 'Channel')}：${g.channel ? `<#${g.channel}>` : t('未設定', 'Not set')}`
                : t('❌ 已停用', '❌ Disabled'),
              inline: true,
            }
          );
        withFooter(embed, client);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (sub === 'goodbye-setup') {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');

        if (!(await requireBotPerm(interaction, PermissionFlagsBits.SendMessages, t('機器人缺少在該頻道發送訊息的權限。', 'The bot cannot send messages in that channel.')))) return;

        await client.settings.update(interaction.guildId, (s) => {
          s.goodbye.enabled = true;
          s.goodbye.channel = channel.id;
          if (message != null) s.goodbye.message = message;
        });
        await sendSuccess(interaction, t(`歡送訊息已啟用，將在 <#${channel.id}> 發送。`, `Goodbye message enabled in <#${channel.id}>.`));
      } else if (sub === 'goodbye-disable') {
        await client.settings.set(interaction.guildId, 'goodbye.enabled', false);
        await sendSuccess(interaction, t('歡送訊息已停用。', 'Goodbye messages disabled.'));
      }
    } catch (e) {
      await sendError(interaction, t(`執行失敗：${e.message || '未知錯誤'}`, `Failed: ${e.message || 'unknown error'}`));
    }
  },
};
