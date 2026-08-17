const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

/** 正規化語言代碼：en -> en、zh-tw -> zh-TW、zh-cn -> zh-CN */
function normalizeLang(code) {
  const parts = String(code).trim().split('-');
  if (parts.length === 2) return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  return parts[0].toLowerCase();
}

/** 解碼 MyMemory 回傳的 HTML 實體 */
function decodeEntities(str) {
  return String(str)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription(t('翻譯文字（使用免費翻譯服務）', 'Translate text (free translation service)'))
    .addStringOption((o) => o.setName('text').setDescription(t('要翻譯的文字', 'Text to translate')).setRequired(true))
    .addStringOption((o) =>
      o
        .setName('to')
        .setDescription(t('目標語言代碼（如 en、ja、ko、zh-CN、de、fr、es）', 'Target language code (e.g. en, ja, zh-CN)'))
        .setRequired(true)
    )
    .addStringOption((o) => o.setName('from').setDescription(t('來源語言代碼（預設 zh-TW）', 'Source language code (default: zh-TW)'))),
  cooldown: 5000,
  async run(interaction, client) {
    try {
      const text = interaction.options.getString('text', true);
      const to = normalizeLang(interaction.options.getString('to', true));
      const from = normalizeLang(interaction.options.getString('from') || 'zh-TW');

      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(to)) {
        return sendError(interaction, t('目標語言代碼格式不正確，例如：en、ja、zh-CN。', 'Invalid target language code format, e.g. en, ja, zh-CN.'));
      }

      await interaction.deferReply();

      let translated;
      try {
        const url =
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
          `&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || data.responseStatus !== 200 || !data.responseData || !data.responseData.translatedText) {
          throw new Error('無效回應');
        }
        translated = decodeEntities(data.responseData.translatedText);
      } catch (e) {
        // 外部 API 失敗：回覆友善錯誤
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.ERROR)
              .setTitle(t('❌ 翻譯失敗', '❌ Translation Failed'))
              .setDescription(t('翻譯服務暫時無法使用，請稍後再試。', 'The translation service is unavailable. Please try again later.'))
              .setTimestamp(),
          ],
        });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('🌐 翻譯結果', '🌐 Translation Result'))
        .addFields(
          { name: t(`原文（${from}）`, `Original (${from})`), value: text.slice(0, 1024) || t('（空白）', '(empty)'), inline: false },
          { name: t(`翻譯（${to}）`, `Translated (${to})`), value: translated.slice(0, 1024) || t('（空白）', '(empty)'), inline: false }
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('翻譯時發生錯誤，請稍後再試。', 'An error occurred while translating. Please try again later.'));
    }
  },
};
