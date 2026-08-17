const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { embedFromData, sendError } = require('../../utils/embeds');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('custom')
    .setDescription('執行伺服器自訂指令')
    .addStringOption((o) => o.setName('name').setDescription('指令名稱').setRequired(true)),
  cooldown: 3000,
  async run(interaction, client) {
    const name = interaction.options.getString('name').toLowerCase();
    const def = await client.settings.getPath(interaction.guild.id, `customCommands.${name}`, null);
    if (!def) {
      return sendError(interaction, `找不到自訂指令 \`${name}\`。使用 \`/customcmd list\` 查看。`);
    }
    if (def.embed) {
      return interaction.reply({ embeds: [embedFromData({ title: name, description: def.response, color: Colors.INFO })] });
    }
    return interaction.reply({ content: def.response });
  },
};
