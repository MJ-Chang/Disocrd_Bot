const { SlashCommandBuilder } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'config',
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription(t('臨時語音頻道設定', 'Temporary voice channel settings'))
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription(t('設定「建立頻道」— 加入後自動生成私人語音頻道', 'Set create channel — private VC auto-created on join'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('建立頻道（語音）', 'Create channel (voice)')).setRequired(true))
        .addChannelOption((o) => o.setName('category').setDescription(t('新頻道放置的分類', 'Category for new channels')))
        .addStringOption((o) => o.setName('name').setDescription(t('頻道名稱範本，{user}=使用者名稱，預設「🔊 {user} 的頻道」', 'Name template, {user}=username, default "🔊 {user} 的頻道"')))
    )
    .addSubcommand((s) => s.setName('disable').setDescription(t('停用臨時語音頻道', 'Disable temporary voice channels'))),
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const category = interaction.options.getChannel('category');
      const nameTemplate = interaction.options.getString('name') || '🔊 {user} 的頻道';
      if (!channel.isVoiceBased()) return sendError(interaction, t('請選擇一個「語音」頻道。', 'Please pick a voice channel.'));
      if (category && !category.isCategory()) return sendError(interaction, t('請選擇一個「分類」頻道。', 'Please pick a category channel.'));

      await client.settings.set(guild.id, 'tempVoice', {
        enabled: true,
        createChannel: channel.id,
        category: category ? category.id : null,
        nameTemplate,
      });
      return sendSuccess(interaction, t(`✅ 已啟用臨時語音！使用者加入 **${channel.name}** 時會自動生成私人頻道。`, `✅ Temp voice enabled! Joining **${channel.name}** auto-creates a private channel.`));
    }

    if (sub === 'disable') {
      await client.settings.set(guild.id, 'tempVoice', {
        enabled: false,
        createChannel: null,
        category: null,
        nameTemplate: '🔊 {user} 的頻道',
      });
      return sendSuccess(interaction, t('已停用臨時語音頻道。', 'Temp voice channels disabled.'));
    }
  },
};
