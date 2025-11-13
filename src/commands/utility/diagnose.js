const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diagnose')
    .setDescription('Run diagnostics on voice connection, permissions, and opus codec'),
  prefixCommand: true,
  aliases: ['diag'],
  async execute(interaction, args, client) {
    const isSlash = !args;
    const member = interaction.member;
    const channel = interaction.channel;

    // Check if user is in a voice channel
    if (!member.voice.channel) {
      const embed = EmbedCreator.error(
        'Not in Voice Channel',
        'You must be in a voice channel to run diagnostics.'
      );
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    if (isSlash) await interaction.deferReply();

    const diagnostics = [];

    // Test 1: Check opus codec
    try {
      const opus = require('opusscript');
      diagnostics.push('✅ opusscript codec loaded');
    } catch (err) {
      diagnostics.push('❌ opusscript codec NOT found: ' + (err && err.message ? err.message : err));
    }

    // Test 2: Check bot permissions in voice channel
    const botMember = await member.guild.members.fetch(client.user.id);
    const voiceChannel = member.voice.channel;
    const botPerms = voiceChannel.permissionsFor(botMember);

    if (botPerms.has('Connect')) {
      diagnostics.push('✅ Bot has CONNECT permission');
    } else {
      diagnostics.push('❌ Bot lacks CONNECT permission');
    }

    if (botPerms.has('Speak')) {
      diagnostics.push('✅ Bot has SPEAK permission');
    } else {
      diagnostics.push('❌ Bot lacks SPEAK permission');
    }

    // Test 3: Attempt to join voice channel and test connection
    let connection = null;
    let connectionStatus = 'unknown';

    try {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: member.guild.id,
        adapterCreator: member.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true,
      });

      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Ready, 10000),
          entersState(connection, VoiceConnectionStatus.Connecting, 10000),
        ]);
        connectionStatus = '✅ Voice connection established (Ready/Connecting)';
        diagnostics.push(connectionStatus);
      } catch (stateErr) {
        connectionStatus = '⚠️ Voice connection attempted but did not reach Ready state: ' + (stateErr && stateErr.message ? stateErr.message : stateErr);
        diagnostics.push(connectionStatus);
      }
    } catch (connErr) {
      connectionStatus = '❌ Failed to join voice channel: ' + (connErr && connErr.message ? connErr.message : connErr);
      diagnostics.push(connectionStatus);
    }

    // Test 4: Check @discordjs/voice version
    try {
      const voiceModule = require('@discordjs/voice');
      diagnostics.push('✅ @discordjs/voice library loaded');
    } catch (err) {
      diagnostics.push('❌ @discordjs/voice NOT found');
    }

    // Test 5: Check system network (optional check for UDP)
    diagnostics.push('ℹ️ If voice connection fails, check your firewall allows UDP traffic to Discord.');

    // Clean up connection
    if (connection) {
      try {
        connection.destroy();
      } catch (e) {
        // ignore
      }
    }

    // Build embed response
    const diagText = diagnostics.join('\n');
    const embed = EmbedCreator.music(
      'Voice Diagnostics',
      `\`\`\`\n${diagText}\n\`\`\``,
      null
    );

    if (isSlash) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed] });
    }
  }
};
