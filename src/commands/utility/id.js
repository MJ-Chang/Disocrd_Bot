const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('id')
    .setDescription(t('取得伺服器中用戶、頻道或身分組的 ID', 'Get the ID of a user, channel, or role'))
    .addUserOption((o) => o.setName('user').setDescription(t('要取得 ID 的用戶', 'User to get the ID of')))
    .addChannelOption((o) => o.setName('channel').setDescription(t('要取得 ID 的頻道', 'Channel to get the ID of')))
    .addRoleOption((o) => o.setName('role').setDescription(t('要取得 ID 的身分組', 'Role to get the ID of'))),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const user = interaction.options.getUser('user');
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');

      if (!user && !channel && !role) {
        return sendError(interaction, t('請至少指定一個目標（用戶 / 頻道 / 身分組）。', 'Please specify at least one target (user / channel / role).'));
      }

      const lines = [];
      if (user) lines.push(t(`用戶：${user.username} → ${user.id}`, `User: ${user.username} → ${user.id}`));
      if (channel) lines.push(t(`頻道：#${channel.name} → ${channel.id}`, `Channel: #${channel.name} → ${channel.id}`));
      if (role) lines.push(t(`身分組：@${role.name} → ${role.id}`, `Role: @${role.name} → ${role.id}`));
      lines.push('', t(`伺服器：${interaction.guild.name} → ${interaction.guild.id}`, `Server: ${interaction.guild.name} → ${interaction.guild.id}`));

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('🆔 ID 列表', '🆔 ID List'))
        .setDescription(`\`\`\`\n${lines.join('\n')}\n\`\`\``)
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('查詢 ID 時發生錯誤。', 'An error occurred while fetching IDs.'));
    }
  },
};
