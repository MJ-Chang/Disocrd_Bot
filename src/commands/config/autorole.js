const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendSuccess, sendError, withFooter } = require('../../utils/embeds');
const { requireBotPerm } = require('../../core/permissions');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'config',
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription(t('設定新成員加入時自動給予的身分組', 'Set roles automatically given to new members'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription(t('新增自動身分組', 'Add an auto role'))
        .addRoleOption((o) => o.setName('role').setDescription(t('要自動給予的身分組', 'Role to auto-give')).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription(t('移除自動身分組', 'Remove an auto role'))
        .addRoleOption((o) => o.setName('role').setDescription(t('要移除的身分組', 'Role to remove')).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription(t('查看目前的自動身分組', 'View current auto roles'))),
  adminOnly: true,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'add') {
        const role = interaction.options.getRole('role');
        if (!(await requireBotPerm(interaction, PermissionFlagsBits.ManageRoles, t('機器人缺少管理身分組的權限。', 'The bot lacks the Manage Roles permission.')))) return;

        const me = interaction.guild.members.me;
        if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
          await sendError(interaction, t('機器人的最高身分組階層必須高於該身分組。', "The bot's highest role must be above that role."));
          return;
        }
        if (role.managed) {
          await sendError(interaction, t('無法自動給予由整合（如遊戲、Bot）管理的身分組。', 'Cannot auto-give roles managed by an integration (game, bot, etc.).'));
          return;
        }

        const s = await client.settings.get(interaction.guildId);
        if (s.autoroles.includes(role.id)) {
          await sendError(interaction, t('該身分組已在自動身分組清單中。', 'That role is already in the auto role list.'));
          return;
        }
        await client.settings.update(interaction.guildId, (st) => st.autoroles.push(role.id));
        await sendSuccess(interaction, t(`已將 <@&${role.id}> 加入自動身分組，新成員加入時將自動獲得。`, `Added <@&${role.id}> to auto roles; new members will get it automatically.`));
      } else if (sub === 'remove') {
        const role = interaction.options.getRole('role');
        const s = await client.settings.get(interaction.guildId);
        if (!s.autoroles.includes(role.id)) {
          await sendError(interaction, t('該身分組不在自動身分組清單中。', 'That role is not in the auto role list.'));
          return;
        }
        await client.settings.update(interaction.guildId, (st) => {
          st.autoroles = st.autoroles.filter((id) => id !== role.id);
        });
        await sendSuccess(interaction, t(`已將 <@&${role.id}> 從自動身分組移除。`, `Removed <@&${role.id}> from auto roles.`));
      } else if (sub === 'list') {
        const s = await client.settings.get(interaction.guildId);
        if (!s.autoroles.length) {
          await sendError(interaction, t('目前尚未設定任何自動身分組。', 'No auto roles are set yet.'));
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(t('⚙️ 自動身分組清單', '⚙️ Auto Role List'))
          .setDescription(s.autoroles.map((id) => `<@&${id}>`).join('\n'));
        withFooter(embed, client, t(`共 ${s.autoroles.length} 個身分組`, `${s.autoroles.length} roles total`));
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (e) {
      await sendError(interaction, t(`執行失敗：${e.message || '未知錯誤'}`, `Execution failed: ${e.message || 'Unknown error'}`));
    }
  },
};
