const { MessageFlags, SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendSuccess, sendError, withFooter } = require('../../utils/embeds');
const { requireBotPerm } = require('../../core/permissions');
const { t } = require('../../utils/i18n');
const verification = require('../../features/verification');

module.exports = {
  category: 'config',
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription(t('設定按鈕驗證系統', 'Set up button verification'))
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription(t('建立驗證面板', 'Create the verification panel'))
        .addChannelOption((o) =>
          o.setName('channel').setDescription(t('驗證面板所在的頻道', 'Channel for the verification panel')).addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addRoleOption((o) => o.setName('role').setDescription(t('驗證通過後授予的身分組', 'Role granted after verifying')).setRequired(true))
        .addStringOption((o) => o.setName('label').setDescription(t('按鈕文字', 'Button text')))
        .addStringOption((o) => o.setName('message').setDescription(t('面板說明文字（可放伺服器規則，支援換行）', 'Panel text (e.g. server rules, supports newlines)')))
    )
    .addSubcommand((sub) =>
      sub
        .setName('message')
        .setDescription(t('更新驗證面板的說明文字（可放伺服器規則）', 'Update the panel text (e.g. server rules)'))
        .addStringOption((o) => o.setName('text').setDescription(t('新的說明內容（支援換行）', 'New text (supports newlines)')).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('disable').setDescription(t('停用驗證系統', 'Disable verification')))
    .addSubcommand((sub) => sub.setName('status').setDescription(t('查看驗證系統狀態', 'View verification status'))),
  adminOnly: true,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const label = interaction.options.getString('label');
        const message = interaction.options.getString('message');

        if (!(await requireBotPerm(interaction, PermissionFlagsBits.SendMessages, t('機器人缺少在該頻道發送訊息的權限。', 'The bot cannot send messages in that channel.')))) return;

        // 身分組階層檢查
        const me = interaction.guild.members.me;
        if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
          await sendError(interaction, t('機器人的最高身分組階層必須高於驗證身分組。', "The bot's highest role must be above the verification role."));
          return;
        }
        if (role.managed) {
          await sendError(interaction, t('無法使用由整合（如遊戲、Bot）管理的身分組作為驗證身分組。', 'Integration-managed roles (e.g. games, bots) cannot be used for verification.'));
          return;
        }

        await verification.setup(client, interaction.guild, channel, role, label, message);
        await sendSuccess(
          interaction,
          t(
            `驗證系統已啟用！面板已發送至 <#${channel.id}>，驗證身分組為 <@&${role.id}>。${message ? '\n已附上自訂說明/規則文字。' : ''}\n之後想改說明文字可用 /verify message。`,
            `Verification enabled! Panel sent to <#${channel.id}>, role: <@&${role.id}>.${message ? '\nCustom rules text attached.' : ''}\nUse /verify message to edit the text later.`
          )
        );
      } else if (sub === 'message') {
        const text = interaction.options.getString('text');
        const result = await verification.updateMessage(client, interaction.guild, text);
        if (!result.ok) return sendError(interaction, result.error);
        await sendSuccess(interaction, t('✅ 驗證面板的說明文字已更新！', '✅ Verification panel text updated!'));
      } else if (sub === 'disable') {
        await client.settings.set(interaction.guildId, 'verify.enabled', false);
        await sendSuccess(interaction, t('驗證系統已停用（原有面板的按鈕將失效）。', 'Verification disabled (existing panel buttons will stop working).'));
      } else if (sub === 'status') {
        const s = await client.settings.get(interaction.guildId);
        const v = s.verify || {};
        const role = v.role ? interaction.guild.roles.cache.get(v.role) : null;
        const msgPreview = v.message ? (v.message.length > 60 ? `${v.message.slice(0, 60)}…` : v.message) : t('（未設定）', '(not set)');
        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(t('🔐 驗證系統狀態', '🔐 Verification Status'))
          .addFields(
            { name: t('狀態', 'Status'), value: v.enabled ? t('✅ 已啟用', '✅ Enabled') : t('❌ 已停用', '❌ Disabled'), inline: true },
            { name: t('頻道', 'Channel'), value: v.channel ? `<#${v.channel}>` : t('未設定', 'Not set'), inline: true },
            { name: t('身分組', 'Role'), value: role ? `<@&${role.id}>` : t('未設定', 'Not set'), inline: true },
            { name: t('按鈕文字', 'Button text'), value: v.buttonLabel || t('✅ 點我驗證', '✅ Verify me'), inline: true },
            { name: t('說明/規則', 'Text / Rules'), value: msgPreview, inline: false }
          );
        withFooter(embed, client);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (e) {
      await sendError(interaction, t(`執行失敗：${e.message || '未知錯誤'}`, `Failed: ${e.message || 'unknown error'}`));
    }
  },
};
