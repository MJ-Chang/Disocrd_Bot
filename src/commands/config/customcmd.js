const { MessageFlags, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');

module.exports = {
  category: 'config',
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('customcmd')
    .setDescription('管理伺服器自訂指令')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('新增自訂指令')
        .addStringOption((o) => o.setName('name').setDescription('指令名稱（小寫英文）').setRequired(true))
        .addStringOption((o) => o.setName('response').setDescription('回覆內容').setRequired(true))
        .addBooleanOption((o) => o.setName('embed').setDescription('是否用 Embed 顯示'))
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('移除自訂指令')
        .addStringOption((o) => o.setName('name').setDescription('指令名稱').setRequired(true))
    )
    .addSubcommand((s) => s.setName('list').setDescription('列出所有自訂指令')),
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '');
      const response = interaction.options.getString('response');
      const embedMode = interaction.options.getBoolean('embed') || false;
      if (!/^[a-z0-9_]{1,32}$/.test(name)) {
        return sendError(interaction, '指令名稱只能包含小寫英文、數字與底線（最多 32 字元）。');
      }
      await client.settings.set(guildId, `customCommands.${name}`, { response, embed: embedMode });
      return interaction.reply({ content: `✅ 已新增自訂指令 \`/${name}\`${embedMode ? '（Embed 模式）' : ''}。`, flags: MessageFlags.Ephemeral });
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name').toLowerCase();
      const exists = await client.settings.getPath(guildId, `customCommands.${name}`, null);
      if (!exists) return sendError(interaction, `找不到自訂指令 \`${name}\`。`);
      await client.settings.update(guildId, (s) => {
        if (s.customCommands && name in s.customCommands) delete s.customCommands[name];
      });
      return interaction.reply({ content: `🗑️ 已移除自訂指令 \`${name}\`。`, flags: MessageFlags.Ephemeral });
    }

    // list
    const s = await client.settings.get(guildId);
    const cmds = Object.entries(s.customCommands || {});
    if (cmds.length === 0) {
      return interaction.reply({ content: '此伺服器還沒有自訂指令。使用 `/customcmd add` 新增。', flags: MessageFlags.Ephemeral });
    }
    const embed = new EmbedBuilder()
      .setColor(Colors.INFO)
      .setTitle('📝 自訂指令列表')
      .setDescription(cmds.map(([name, def]) => `\`/${name}\`${def.embed ? '（Embed）' : ''}`).join('\n'))
      .setFooter({ text: `共 ${cmds.length} 個` });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
