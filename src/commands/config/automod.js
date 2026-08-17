const { MessageFlags, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { sendSuccess, sendError, withFooter } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

const ACTION_LABELS = {
  delete: t('🗑️ 刪除訊息', '🗑️ Delete message'),
  warn: t('⚠️ 記警告', '⚠️ Warn'),
  timeout: t('⏱️ 禁言 10 分鐘', '⏱️ Timeout 10 min'),
  kick: t('👢 踢出伺服器', '👢 Kick'),
  ban: t('🔨 封鎖', '🔨 Ban'),
};

const TOGGLE_LABELS = {
  invites: t('封鎖邀請連結', 'Block invite links'),
  links: t('封鎖外部連結', 'Block external links'),
  caps: t('全大寫偵測', 'Detect all-caps'),
  mentions: t('大量提及偵測', 'Detect mass mentions'),
  spam: t('洗頻偵測', 'Detect spam'),
  duplicate: t('重複訊息偵測', 'Detect duplicate messages'),
};

module.exports = {
  category: 'config',
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription(t('自動審核設定（敏感詞、連結、洗頻等）', 'Auto-moderation settings (bad words, links, spam, etc.)'))
    .addSubcommand((sub) => sub.setName('enable').setDescription(t('啟用自動審核', 'Enable auto-moderation')))
    .addSubcommand((sub) => sub.setName('disable').setDescription(t('停用自動審核', 'Disable auto-moderation')))
    .addSubcommand((sub) => sub.setName('status').setDescription(t('查看自動審核狀態', 'View auto-moderation status')))
    .addSubcommand((sub) =>
      sub
        .setName('word')
        .setDescription(t('管理過濾字詞', 'Manage filtered words'))
        .addStringOption((o) =>
          o.setName('action').setDescription(t('動作', 'Action')).setRequired(true).addChoices(
            { name: t('新增', 'Add'), value: 'add' },
            { name: t('移除', 'Remove'), value: 'remove' }
          )
        )
        .addStringOption((o) => o.setName('word').setDescription(t('要新增/移除的字詞', 'Word to add/remove')).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('words').setDescription(t('列出所有過濾字詞', 'List all filtered words')))
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription(t('開啟/關閉偵測項目', 'Toggle detection features'))
        .addStringOption((o) =>
          o.setName('setting').setDescription(t('偵測項目', 'Detection feature')).setRequired(true).addChoices(
            ...Object.entries(TOGGLE_LABELS).map(([value, name]) => ({ name, value }))
          )
        )
        .addBooleanOption((o) => o.setName('enabled').setDescription(t('開啟或關閉', 'Enable or disable')).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('action')
        .setDescription(t('違規時的處理動作', 'Action on violations'))
        .addStringOption((o) =>
          o.setName('action').setDescription(t('處理方式', 'Handling action')).setRequired(true).addChoices(
            ...Object.entries(ACTION_LABELS).map(([value, name]) => ({ name, value }))
          )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignore')
        .setDescription(t('新增/移除忽略頻道（該頻道不審核）', 'Add/remove ignored channels (not moderated)'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('要忽略的頻道', 'Channel to ignore')).setRequired(true))
    ),
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    try {
      if (sub === 'enable') {
        await client.settings.set(guildId, 'automod.enabled', true);
        await sendSuccess(interaction, t('自動審核已啟用！可使用 `/automod toggle`、`/automod word`、`/automod action` 調整規則。', 'Auto-moderation enabled! Use `/automod toggle`, `/automod word`, `/automod action` to adjust rules.'));
      } else if (sub === 'disable') {
        await client.settings.set(guildId, 'automod.enabled', false);
        await sendSuccess(interaction, t('自動審核已停用。', 'Auto-moderation disabled.'));
      } else if (sub === 'status') {
        const a = (await client.settings.get(guildId)).automod || {};
        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(t('🤖 自動審核設定', '🤖 Auto-Mod Settings'))
          .addFields(
            { name: t('狀態', 'Status'), value: a.enabled ? t('✅ 已啟用', '✅ Enabled') : t('❌ 已停用', '❌ Disabled'), inline: true },
            { name: t('違規動作', 'Action'), value: ACTION_LABELS[a.action] || a.action || t('未設定', 'Not set'), inline: true },
            { name: t('過濾字詞數', 'Filtered words'), value: t(`${(a.bannedWords || []).length} 個`, `${(a.bannedWords || []).length}`), inline: true },
            ...Object.entries(TOGGLE_LABELS).map(([key, label]) => ({
              name: label,
              value: a[key] ? t('✅ 開啟', '✅ On') : t('❌ 關閉', '❌ Off'),
              inline: true,
            }))
          );
        if (a.ignoreChannels?.length) {
          embed.addFields({ name: t('忽略頻道', 'Ignored channels'), value: a.ignoreChannels.map((id) => `<#${id}>`).join(' '), inline: false });
        }
        withFooter(embed, client);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (sub === 'word') {
        const action = interaction.options.getString('action');
        const word = interaction.options.getString('word').toLowerCase().trim();
        if (!word) return sendError(interaction, t('字詞不能為空。', 'The word cannot be empty.'));
        await client.settings.update(guildId, (s) => {
          const list = s.automod.bannedWords || [];
          if (action === 'add') {
            if (!list.includes(word)) list.push(word);
          } else {
            s.automod.bannedWords = list.filter((w) => w !== word);
          }
        });
        const after = (await client.settings.getPath(guildId, 'automod.bannedWords', []));
        await sendSuccess(interaction, action === 'add'
          ? t(`已新增過濾字詞「${word}」（目前 ${after.length} 個）。`, `Added filter word "${word}" (now ${after.length} total).`)
          : t(`已移除過濾字詞「${word}」（目前 ${after.length} 個）。`, `Removed filter word "${word}" (now ${after.length} total).`));
      } else if (sub === 'words') {
        const words = await client.settings.getPath(guildId, 'automod.bannedWords', []);
        if (!words.length) return sendError(interaction, t('目前沒有任何過濾字詞。', 'No filter words yet.'));
        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(t('📝 過濾字詞清單', '📝 Filter Words'))
          .setDescription(words.map((w) => `\`${w}\``).join(' '))
          .setFooter({ text: t(`共 ${words.length} 個`, `${words.length} total`) });
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (sub === 'toggle') {
        const setting = interaction.options.getString('setting');
        const enabled = interaction.options.getBoolean('enabled');
        await client.settings.set(guildId, `automod.${setting}`, enabled);
        await sendSuccess(interaction, t(`已${enabled ? '開啟' : '關閉'}「${TOGGLE_LABELS[setting]}」。`, `${enabled ? 'Enabled' : 'Disabled'} "${TOGGLE_LABELS[setting]}".`));
      } else if (sub === 'action') {
        const action = interaction.options.getString('action');
        await client.settings.set(guildId, 'automod.action', action);
        await sendSuccess(interaction, t(`違規處理動作已設為：${ACTION_LABELS[action]}。`, `Violation action set to: ${ACTION_LABELS[action]}.`));
      } else if (sub === 'ignore') {
        const channel = interaction.options.getChannel('channel');
        await client.settings.update(guildId, (s) => {
          const list = s.automod.ignoreChannels || [];
          if (list.includes(channel.id)) {
            s.automod.ignoreChannels = list.filter((id) => id !== channel.id);
          } else {
            list.push(channel.id);
            s.automod.ignoreChannels = list;
          }
        });
        const ignored = await client.settings.getPath(guildId, 'automod.ignoreChannels', []);
        await sendSuccess(interaction, ignored.includes(channel.id)
          ? t(`已將 <#${channel.id}> 加入忽略清單（該頻道不審核）。`, `Added <#${channel.id}> to the ignore list (not moderated).`)
          : t(`已將 <#${channel.id}> 移出忽略清單。`, `Removed <#${channel.id}> from the ignore list.`));
      }
    } catch (e) {
      await sendError(interaction, t(`執行失敗：${e.message || '未知錯誤'}`, `Execution failed: ${e.message || 'Unknown error'}`));
    }
  },
};
