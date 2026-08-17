const { MessageFlags, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter } = require('../../utils/embeds');

/** 解析 "名稱|內容|inline" 欄位字串 */
function parseField(text) {
  const parts = String(text).split('|').map((p) => p.trim());
  return {
    name: (parts[0] || '欄位').slice(0, 256),
    value: (parts[1] || '—').slice(0, 1024),
    inline: parts[2] === 'true' || parts[2] === '1' || parts[2] === 'inline',
  };
}

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('建立自訂 Embed 訊息')
    .addStringOption((o) => o.setName('title').setDescription('標題').setRequired(true))
    .addStringOption((o) => o.setName('description').setDescription('內容描述').setRequired(true))
    .addStringOption((o) => o.setName('color').setDescription('顏色（HEX，例如 5865F2）'))
    .addStringOption((o) => o.setName('image').setDescription('圖片網址'))
    .addStringOption((o) => o.setName('thumbnail').setDescription('縮圖網址'))
    .addStringOption((o) => o.setName('footer').setDescription('頁尾文字'))
    .addStringOption((o) => o.setName('field1').setDescription('欄位1，格式：名稱|內容|inline'))
    .addStringOption((o) => o.setName('field2').setDescription('欄位2，格式：名稱|內容|inline'))
    .addStringOption((o) => o.setName('field3').setDescription('欄位3，格式：名稱|內容|inline'))
    .addStringOption((o) => o.setName('field4').setDescription('欄位4，格式：名稱|內容|inline'))
    .addStringOption((o) => o.setName('field5').setDescription('欄位5，格式：名稱|內容|inline')),
  async run(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: '❌ 你需要「管理訊息」權限才能使用此指令。', flags: MessageFlags.Ephemeral });
    }
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const colorRaw = interaction.options.getString('color');
    const color = colorRaw ? parseInt(colorRaw.replace('#', ''), 16) : client.config.colorMain;

    const embed = new EmbedBuilder()
      .setColor(Number.isNaN(color) ? client.config.colorMain : color)
      .setTitle(title)
      .setDescription(description);

    const image = interaction.options.getString('image');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');
    if (image) embed.setImage(image);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (footer) embed.setFooter({ text: footer });

    for (let i = 1; i <= 5; i++) {
      const raw = interaction.options.getString(`field${i}`);
      if (raw) embed.addFields(parseField(raw));
    }
    withFooter(embed, client);

    await interaction.reply({ embeds: [embed] });
  },
};
