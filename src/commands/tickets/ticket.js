const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireAdmin, isModerator } = require('../../core/permissions');
const tickets = require('../../features/tickets');
const { logger } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

/** 需要管理員權限的子指令 */
const ADMIN_SUBS = new Set(['setup', 'disable']);

/** 檢查呼叫者是否為管理人員，或該客服單的開單用戶 */
function canAct(interaction, client, channel) {
  if (isModerator(interaction.member)) return true;
  const record = channel ? client.db.collection('tickets').get(channel.id) : null;
  return !!(record && record.userId === interaction.user.id);
}

module.exports = {
  category: 'tickets',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription(t('客服表單管理', 'Ticket system'))
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription(t('設定客服表單系統', 'Set up ticket system'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('面板要發送到的頻道', 'Channel for the panel')).setRequired(true))
        .addChannelOption((o) => o.setName('category').setDescription(t('客服單分類', 'Ticket category')).setRequired(true))
        .addRoleOption((o) => o.setName('support_role').setDescription(t('支援人員角色', 'Support role')))
        .addChannelOption((o) => o.setName('transcript_channel').setDescription(t('轉錄頻道', 'Transcript channel')))
        .addIntegerOption((o) =>
          o.setName('max_tickets').setDescription(t('每位用戶最多可同時開啟的客服單數量', 'Max open tickets per user')).setMinValue(1)
        )
    )
    .addSubcommand((s) => s.setName('disable').setDescription(t('停用客服表單系統', 'Disable ticket system')))
    .addSubcommand((s) =>
      s
        .setName('close')
        .setDescription(t('關閉客服單', 'Close ticket'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('要關閉的客服單頻道（預設為目前頻道）', 'Ticket channel to close (default: current)'))
        )
    )
    .addSubcommand((s) => s.setName('claim').setDescription(t('認領客服單', 'Claim ticket')))
    .addSubcommand((s) => s.setName('transcript').setDescription(t('產生客服單轉錄', 'Create ticket transcript')))
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription(t('新增成員到客服單', 'Add member to ticket'))
        .addUserOption((o) => o.setName('user').setDescription(t('要新增的成員', 'Member to add')).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription(t('從客服單移除成員', 'Remove member from ticket'))
        .addUserOption((o) => o.setName('user').setDescription(t('要移除的成員', 'Member to remove')).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('rename')
        .setDescription(t('重新命名客服單頻道', 'Rename ticket channel'))
        .addStringOption((o) => o.setName('name').setDescription(t('新的頻道名稱', 'New channel name')).setRequired(true))
    ),
  cooldown: 3000,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (ADMIN_SUBS.has(sub) && !(await requireAdmin(interaction))) return;

    const targetChannel =
      sub === 'close' ? interaction.options.getChannel('channel') || interaction.channel : interaction.channel;

    // 一般子指令：管理人員或開單者才能執行
    if (!ADMIN_SUBS.has(sub) && !canAct(interaction, client, targetChannel)) {
      await sendError(interaction, t('你沒有權限執行此操作（僅限管理人員或開單用戶）。', 'You do not have permission (moderators and the ticket owner only).'));
      return;
    }

    try {
      switch (sub) {
        case 'setup': {
          const channel = interaction.options.getChannel('channel');
          const category = interaction.options.getChannel('category');
          if (!channel || !channel.isTextBased()) {
            await sendError(interaction, t('面板頻道必須是文字頻道。', 'The panel channel must be a text channel.'));
            return;
          }
          if (!category || category.type !== ChannelType.GuildCategory) {
            await sendError(interaction, t('請選擇一個「分類」頻道作為客服單分類。', 'Please choose a category channel for tickets.'));
            return;
          }
          const supportRole = interaction.options.getRole('support_role');
          const transcriptChannel = interaction.options.getChannel('transcript_channel');
          const maxTickets = interaction.options.getInteger('max_tickets');
          await tickets.setup(client, guild, channel, category, supportRole, transcriptChannel, maxTickets);
          await sendSuccess(interaction, t(`客服表單系統已設定完成！面板已發送到 ${channel}。`, `Ticket system set up! Panel sent to ${channel}.`));
          break;
        }

        case 'disable': {
          await client.settings.set(guild.id, 'tickets.enabled', false);
          await sendSuccess(interaction, t('客服表單系統已停用。', 'Ticket system disabled.'));
          break;
        }

        case 'close': {
          await tickets.closeTicket(client, interaction, targetChannel);
          break;
        }

        case 'claim': {
          await tickets.claimTicket(client, interaction, targetChannel);
          break;
        }

        case 'transcript': {
          await tickets.createTranscript(client, interaction, targetChannel);
          break;
        }

        case 'add': {
          if (!client.db.collection('tickets').get(targetChannel.id)) {
            await sendError(interaction, t('此頻道不是有效的客服單。', 'This channel is not a valid ticket.'));
            return;
          }
          const user = interaction.options.getUser('user');
          await targetChannel.permissionOverwrites.edit(user.id, {
            ViewChannel: true,
            SendMessages: true,
          });
          await sendSuccess(interaction, t(`已將 ${user} 新增到客服單。`, `Added ${user} to the ticket.`));
          break;
        }

        case 'remove': {
          if (!client.db.collection('tickets').get(targetChannel.id)) {
            await sendError(interaction, t('此頻道不是有效的客服單。', 'This channel is not a valid ticket.'));
            return;
          }
          const user = interaction.options.getUser('user');
          await targetChannel.permissionOverwrites.delete(user.id).catch(async () => {
            await targetChannel.permissionOverwrites.edit(user.id, {
              ViewChannel: false,
              SendMessages: false,
            });
          });
          await sendSuccess(interaction, t(`已將 ${user} 從客服單移除。`, `Removed ${user} from the ticket.`));
          break;
        }

        case 'rename': {
          if (!client.db.collection('tickets').get(targetChannel.id)) {
            await sendError(interaction, t('此頻道不是有效的客服單。', 'This channel is not a valid ticket.'));
            return;
          }
          const name = interaction.options.getString('name');
          const clean = tickets.sanitizeName(name, 100);
          if (!clean || clean === 'ticket') {
            await sendError(interaction, t('頻道名稱無效。', 'Invalid channel name.'));
            return;
          }
          await targetChannel.setName(clean);
          await sendSuccess(interaction, t(`客服單頻道已重新命名為 **${clean}**。`, `Ticket channel renamed to **${clean}**.`));
          break;
        }

        default:
          await sendError(interaction, t('未知的子指令。', 'Unknown subcommand.'));
      }
    } catch (e) {
      logger.error('ticket', `執行 ticket 指令失敗：${e.stack || e.message}`);
      await sendError(interaction, t('執行 ticket 指令時發生錯誤，請稍後再試。', 'An error occurred while running the ticket command, please try again later.'));
    }
  },
};
