const { MessageFlags, SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendSuccess, sendError, withFooter } = require('../../utils/embeds');
const { requireBotPerm } = require('../../core/permissions');
const { logger } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

/** 自訂表情格式：<:name:id> 或 <a:name:id> */
const CUSTOM_EMOJI_RE = /^<a?:[^:]+:\d+>$/;

/** 粗略驗證是否為 Unicode 表情（含旗幟、keycap、ZWJ 序列） */
function isUnicodeEmoji(str) {
  if (typeof str !== 'string' || !str || str.length > 16) return false;
  return /^[\p{Extended_Pictographic}\u200D\uFE0F\u20E3\u2190-\u21FF\u2B00-\u2BFF\u2600-\u27BF\u00A9\u00AE\u2122\u{1F1E6}-\u{1F1FF}0-9#*]+$/u.test(str);
}

/** 驗證表情格式（unicode 或自訂表情） */
function isValidEmoji(str) {
  if (typeof str !== 'string' || !str) return false;
  return CUSTOM_EMOJI_RE.test(str) || isUnicodeEmoji(str);
}

module.exports = {
  category: 'config',
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription(t('設定反應身分組（對訊息加入表情以取得身分組）', 'Set up reaction roles (react to a message to get a role)'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription(t('新增反應身分組', 'Add a reaction role'))
        .addChannelOption((o) =>
          o.setName('channel').setDescription(t('訊息所在的頻道', 'Channel of the message')).addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addStringOption((o) => o.setName('message_id').setDescription(t('訊息的 ID', 'Message ID')).setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription(t('表情（Unicode 或 <:name:id>）', 'Emoji (Unicode or <:name:id>)')).setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription(t('要給予的身分組', 'Role to give')).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription(t('移除反應身分組', 'Remove a reaction role'))
        .addStringOption((o) => o.setName('message_id').setDescription(t('訊息的 ID', 'Message ID')).setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription(t('表情', 'Emoji')).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription(t('查看目前的反應身分組', 'View current reaction roles')))
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription(t('建立反應身分組面板', 'Create a reaction role panel'))
        .addChannelOption((o) =>
          o.setName('channel').setDescription(t('面板所在的頻道', 'Panel channel')).addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addStringOption((o) => o.setName('title').setDescription(t('面板標題', 'Panel title')))
    ),
  adminOnly: true,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'add') {
        const channel = interaction.options.getChannel('channel');
        const messageId = interaction.options.getString('message_id');
        const emoji = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role');

        if (!(await requireBotPerm(interaction, PermissionFlagsBits.ManageRoles, t('機器人缺少管理身分組的權限。', 'The bot lacks the Manage Roles permission.')))) return;

        if (!isValidEmoji(emoji)) {
          await sendError(interaction, t('表情格式無效，請輸入 Unicode 表情或自訂表情（<:name:id>）。', 'Invalid emoji. Use a Unicode emoji or a custom emoji (<:name:id>).'));
          return;
        }
        const me = interaction.guild.members.me;
        if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
          await sendError(interaction, t('機器人的最高身分組階層必須高於該身分組。', "The bot's highest role must be above that role."));
          return;
        }
        if (role.managed) {
          await sendError(interaction, t('無法使用由整合（如遊戲、Bot）管理的身分組。', 'Cannot use roles managed by an integration (game, bot, etc.).'));
          return;
        }

        // 確認訊息存在
        let message = null;
        try {
          message = await channel.messages.fetch(messageId);
        } catch (e) {
          message = null;
        }
        if (!message) {
          await sendError(interaction, t('找不到該訊息，請確認頻道與訊息 ID 是否正確。', 'Message not found. Check the channel and message ID.'));
          return;
        }

        const s = await client.settings.get(interaction.guildId);
        if (s.reactionRoles.some((c) => c.guildId === interaction.guildId && c.messageId === messageId && c.emoji === emoji)) {
          await sendError(interaction, t('該訊息與表情已經有對應的身分組設定。', 'That message + emoji already has a reaction role.'));
          return;
        }

        await client.settings.update(interaction.guildId, (st) => {
          st.reactionRoles.push({ messageId, channelId: channel.id, emoji, roleId: role.id, guildId: interaction.guildId });
        });

        // 嘗試自動加上機器人反應（失敗不影響設定）
        try {
          await message.react(emoji);
        } catch (e) {
          logger.debug('reactionrole', `自動加上反應失敗：${e.message}`);
        }

        await sendSuccess(
          interaction,
          t(`已設定 ${emoji} → <@&${role.id}>（[查看訊息](https://discord.com/channels/${interaction.guildId}/${channel.id}/${messageId})）。`, `Set ${emoji} → <@&${role.id}> ([view message](https://discord.com/channels/${interaction.guildId}/${channel.id}/${messageId})).`)
        );
      } else if (sub === 'remove') {
        const messageId = interaction.options.getString('message_id');
        const emoji = interaction.options.getString('emoji');
        const s = await client.settings.get(interaction.guildId);
        const before = s.reactionRoles.length;
        await client.settings.update(interaction.guildId, (st) => {
          st.reactionRoles = st.reactionRoles.filter(
            (c) => !(c.guildId === interaction.guildId && c.messageId === messageId && c.emoji === emoji)
          );
        });
        const after = (await client.settings.get(interaction.guildId)).reactionRoles.length;
        if (before === after) {
          await sendError(interaction, t('找不到符合的反應身分組設定。', 'No matching reaction role found.'));
          return;
        }
        await sendSuccess(interaction, t('已移除該反應身分組設定。', 'Reaction role removed.'));
      } else if (sub === 'list') {
        const s = await client.settings.get(interaction.guildId);
        const entries = s.reactionRoles.filter((c) => c.guildId === interaction.guildId);
        if (!entries.length) {
          await sendError(interaction, t('目前尚未設定任何反應身分組。', 'No reaction roles are set yet.'));
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(t('🎯 反應身分組清單', '🎯 Reaction Role List'))
          .setDescription(
            entries
              .map(
                (c, i) =>
                  `${i + 1}. ${c.emoji} → <@&${c.roleId}>\n　└ <#${c.channelId}> [${t('跳轉', 'Jump')}](https://discord.com/channels/${c.guildId}/${c.channelId}/${c.messageId})`
              )
              .join('\n\n')
          );
        withFooter(embed, client, t(`共 ${entries.length} 個設定`, `${entries.length} configs total`));
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (sub === 'panel') {
        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const s = await client.settings.get(interaction.guildId);
        const entries = s.reactionRoles.filter((c) => c.guildId === interaction.guildId);
        if (!entries.length) {
          await sendError(interaction, t('此伺服器尚未設定任何反應身分組，請先使用 /reactionrole add 新增。', 'No reaction roles set on this server. Use /reactionrole add first.'));
          return;
        }
        if (!(await requireBotPerm(interaction, PermissionFlagsBits.SendMessages, t('機器人缺少在該頻道發送訊息的權限。', 'The bot lacks permission to send messages in that channel.')))) return;

        const embed = new EmbedBuilder()
          .setColor(client.config.colorMain)
          .setTitle(title || t('🎯 反應身分組', '🎯 Reaction Roles'))
          .setDescription(
            t('對下方的表情加入反應，即可獲得對應身分組！\n\n', 'React with the emojis below to get the matching role!\n\n') +
              entries.map((c) => `${c.emoji} → <@&${c.roleId}>`).join('\n')
          );
        withFooter(embed, client);
        const msg = await channel.send({ embeds: [embed] });

        // 將所有條目的 messageId 更新為新面板訊息 ID
        await client.settings.update(interaction.guildId, (st) => {
          for (const c of st.reactionRoles) {
            if (c.guildId === interaction.guildId) c.messageId = msg.id;
          }
        });

        // 自動加上所有表情反應（失敗不影響面板）
        for (const c of entries) {
          try {
            await msg.react(c.emoji);
          } catch (e) {
            /* 靜默 */
          }
        }
        await sendSuccess(interaction, t(`已建立反應身分組面板：<#${channel.id}>`, `Reaction role panel created: <#${channel.id}>`));
      }
    } catch (e) {
      await sendError(interaction, t(`執行失敗：${e.message || '未知錯誤'}`, `Execution failed: ${e.message || 'Unknown error'}`));
    }
  },
};
