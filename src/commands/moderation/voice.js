const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm, canManageMember } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

/** 確認目標成員存在且在語音頻道中 */
async function requireVoiceMember(interaction) {
  const target = interaction.options.getUser('user');
  const member = interaction.guild.members.cache.get(target.id);
  if (!member) return { error: t('該成員不在伺服器中。', 'That member is not in the server.') };
  if (!member.voice.channelId) return { error: t(`**${target.tag}** 不在任何語音頻道中。`, `**${target.tag}** is not in any voice channel.`) };
  return { member };
}

/** 建立語音管理指令 */
function makeVoiceCommand(name, description, perm, permMessage, verb, actionLabel, apply) {
  return {
    category: 'moderation',
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addUserOption((o) => o.setName('user').setDescription(t('要操作的成員', 'Member to manage')).setRequired(true)),
    modOnly: true,
    async run(interaction, client) {
      const target = interaction.options.getUser('user');
      if (!(await requireBotPerm(interaction, perm, permMessage))) return;

      const { member, error } = await requireVoiceMember(interaction);
      if (error) return sendError(interaction, error);
      if (!canManageMember(interaction, member)) {
        return sendError(interaction, t('你無法操作該成員（對方是管理員或角色階層過高）。', "You can't manage this member (admin or higher role)."));
      }

      try {
        await apply(member);
      } catch (e) {
        return sendError(interaction, t('操作失敗，請確認機器人權限與成員狀態。', 'Operation failed. Check bot permissions and member status.'));
      }

      await logModAction(
        client,
        interaction.guild,
        actionLabel,
        target,
        interaction.member,
        t(`語音頻道：${member.voice.channel?.name || t('未知', 'Unknown')}`, `Voice channel: ${member.voice.channel?.name || t('未知', 'Unknown')}`)
      );
      return sendSuccess(interaction, t(`已將 **${target.tag}** ${verb}。`, `${verb} **${target.tag}**.`));
    },
  };
}

module.exports = [
  makeVoiceCommand(
    'vkick',
    t('將成員移出語音頻道', 'Move a member out of voice'),
    PermissionFlagsBits.MoveMembers,
    t('❌ 機器人缺少「移動成員」權限。', "❌ Missing 'Move Members' permission."),
    t('移出語音頻道', 'Moved out of the voice channel'),
    t('移出語音（vkick）', 'Voice kick (vkick)'),
    (m) => m.voice.disconnect(t('管理指令 vkick', 'Command: vkick'))
  ),
  makeVoiceCommand(
    'vmute',
    t('將成員語音靜音', 'Voice mute a member'),
    PermissionFlagsBits.MuteMembers,
    t('❌ 機器人缺少「靜音成員」權限。', "❌ Missing 'Mute Members' permission."),
    t('語音靜音', 'Voice muted'),
    t('語音靜音（vmute）', 'Voice mute (vmute)'),
    (m) => m.voice.setMute(true, t('管理指令 vmute', 'Command: vmute'))
  ),
  makeVoiceCommand(
    'vunmute',
    t('解除成員語音靜音', 'Unmute a member in voice'),
    PermissionFlagsBits.MuteMembers,
    t('❌ 機器人缺少「靜音成員」權限。', "❌ Missing 'Mute Members' permission."),
    t('解除語音靜音', 'Voice unmuted'),
    t('解除語音靜音（vunmute）', 'Voice unmute (vunmute)'),
    (m) => m.voice.setMute(false, t('管理指令 vunmute', 'Command: vunmute'))
  ),
  makeVoiceCommand(
    'vdeafen',
    t('將成員語音關閉聽覺', 'Deafen a member in voice'),
    PermissionFlagsBits.DeafenMembers,
    t('❌ 機器人缺少「關閉聽覺」權限。', "❌ Missing 'Deafen Members' permission."),
    t('關閉語音聽覺', 'Deafened'),
    t('關閉語音聽覺（vdeafen）', 'Voice deafen (vdeafen)'),
    (m) => m.voice.setDeaf(true, t('管理指令 vdeafen', 'Command: vdeafen'))
  ),
  makeVoiceCommand(
    'vundeafen',
    t('解除成員語音關閉聽覺', 'Undeafen a member in voice'),
    PermissionFlagsBits.DeafenMembers,
    t('❌ 機器人缺少「關閉聽覺」權限。', "❌ Missing 'Deafen Members' permission."),
    t('解除語音關閉', 'Undeafened'),
    t('解除語音關閉（vundeafen）', 'Voice undeafen (vundeafen)'),
    (m) => m.voice.setDeaf(false, t('管理指令 vundeafen', 'Command: vundeafen'))
  ),
];
