import {
  SoftwareRenderer,
  GlRenderer,
  IRenderer,
  CustomRenderer
} from '../Renderer';
import {
  NodeRtcEngine,
  NodeRtcChannel,
  RtcStats,
  LocalVideoStats,
  LocalAudioStats,
  RemoteVideoStats,
  RemoteAudioStats,
  RemoteVideoTransportStats,
  RemoteAudioTransportStats,
  RemoteVideoState,
  RemoteVideoStateReason,
  RemoteAudioState,
  RemoteAudioStateReason,
  AgoraNetworkQuality,
  LastmileProbeResult,
  ClientRoleType,
  StreamType,
  ConnectionState,
  ConnectionChangeReason,
  MediaDeviceType,
  VIDEO_PROFILE_TYPE,
  TranscodingConfig,
  InjectStreamConfig,
  VoiceChangerPreset,
  AudioReverbPreset,
  LastmileProbeConfig,
  Priority,
  CameraCapturerConfiguration,
  ScreenSymbol,
  CaptureRect,
  CaptureParam,
  VideoContentHint,
  VideoEncoderConfiguration,
  UserInfo,
  RendererOptions,
  Metadata,
  RTMP_STREAMING_EVENT,
  AREA_CODE,
  STREAM_PUBLISH_STATE,
  STREAM_SUBSCRIBE_STATE,
  AUDIO_ROUTE_TYPE,
  EncryptionConfig,
  AUDIO_EFFECT_PRESET,
  VOICE_BEAUTIFIER_PRESET,
  AUDIENCE_LATENCY_LEVEL_TYPE,
  ClientRoleOptions,
  VideoBackgroundSource,
  VIDEO_BACKGROUND_SOURCE_STATE_REASON
} from './native_type';
import { EventEmitter } from 'events';
import { deprecate, config, Config } from '../Utils';
import { ChannelMediaOptions, WatermarkOptions } from './native_type';
import {
  ChannelMediaRelayEvent,
  ChannelMediaRelayState,
  ChannelMediaRelayError,
  ChannelMediaRelayConfiguration
} from './native_type';
import {
  PluginInfo,
  Plugin
} from './plugin';
import path from 'path';
const agora = require('../../build/Release/agora_node_ext');

/**
 * The AgoraRtcEngine class.
 */
class AgoraRtcEngine extends EventEmitter {
  rtcEngine: NodeRtcEngine;
  streams: Map<string, Map<string, IRenderer[]>>;
  renderMode: 1 | 2 | 3;
  customRenderer: any;
  constructor() {
    super();
    this.rtcEngine = new agora.NodeRtcEngine();
    this.initEventHandler();
    this.streams = new Map();
    this.renderMode = this._checkWebGL() ? 1 : 2;
    this.customRenderer = CustomRenderer;
  }

  /**
   * return sdk config object
   */
  getConfigObject(): Config {
    return config
  }

  /**
   * Decide whether to use webgl/software/custom rendering.
   * @param {1|2|3} mode:
   * - 1 for old webgl rendering.
   * - 2 for software rendering.
   * - 3 for custom rendering.
   */
  setRenderMode(mode: 1 | 2 | 3 = 1): void {
    this.renderMode = mode;
  }

  /**
   * Use this method to set custom Renderer when set renderMode in the
   * {@link setRenderMode} method to 3.
   * CustomRender should be a class.
   * @param {IRenderer} customRenderer Customizes the video renderer.
   */
  setCustomRenderer(customRenderer: IRenderer) {
    this.customRenderer = customRenderer;
  }

  /**
   * @private
   * @ignore
   * check if WebGL will be available with appropriate features
   * @return {boolean}
   */
  _checkWebGL(): boolean {
    const canvas = document.createElement('canvas');
    let gl;

    canvas.width = 1;
    canvas.height = 1;

    const options = {
      // Turn off things we don't need
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preferLowPowerToHighPerformance: true

      // Still dithering on whether to use this.
      // Recommend avoiding it, as it's overly conservative
      // failIfMajorPerformanceCaveat: true
    };

    try {
      gl =
        canvas.getContext('webgl', options) ||
        canvas.getContext('experimental-webgl', options);
    } catch (e) {
      return false;
    }
    if (gl) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * init event handler
   * @private
   * @ignore
   */
  initEventHandler(): void {
    const self = this;

    const fire = (event: string, ...args: Array<any>) => {
      setImmediate(() => {
        this.emit(event, ...args);
      });
    };

    this.rtcEngine.onEvent('apierror', (funcName: string) => {
      console.error(`api ${funcName} failed. this is an error
              thrown by c++ addon layer. it often means sth is
              going wrong with this function call and it refused
              to do what is asked. kindly check your parameter types
              to see if it matches properly.`);
    });

    this.rtcEngine.onEvent('joinchannel', function(
      channel: string,
      uid: number,
      elapsed: number
    ) {
      fire('joinedchannel', channel, uid, elapsed);
      fire('joinedChannel', channel, uid, elapsed);
    });

    this.rtcEngine.onEvent('rejoinchannel', function(
      channel: string,
      uid: number,
      elapsed: number
    ) {
      fire('rejoinedchannel', channel, uid, elapsed);
      fire('rejoinedChannel', channel, uid, elapsed);
    });

    this.rtcEngine.onEvent('warning', function(warn: number, msg: string) {
      fire('warning', warn, msg);
    });

    this.rtcEngine.onEvent('error', function(err: number, msg: string) {
      fire('error', err, msg);
    });

    // this.rtcEngine.onEvent('audioquality', function(uid: number, quality: AgoraNetworkQuality, delay: number, lost: number) {
    //   fire('audioquality', uid, quality, delay, lost);
    //   fire('audioQuality', uid, quality, delay, lost);
    // });

    this.rtcEngine.onEvent('audiovolumeindication', function(
      speakers: {
        uid: number;
        volume: number;
        vad: boolean;
      }[],
      speakerNumber: number,
      totalVolume: number
    ) {
      fire('audioVolumeIndication', speakers, speakerNumber, totalVolume);
      fire('groupAudioVolumeIndication', speakers, speakerNumber, totalVolume);
    });

    this.rtcEngine.onEvent('leavechannel', function(rtcStats: RtcStats) {
      fire('leavechannel', rtcStats);
      fire('leaveChannel', rtcStats);
    });

    this.rtcEngine.onEvent('rtcstats', function(stats: RtcStats) {
      fire('rtcstats', stats);
      fire('rtcStats', stats);
    });

    this.rtcEngine.onEvent('localvideostats', function(stats: LocalVideoStats) {
      fire('localvideostats', stats);
      fire('localVideoStats', stats);
    });

    this.rtcEngine.onEvent('localAudioStats', function(stats: LocalAudioStats) {
      fire('localAudioStats', stats);
    });

    this.rtcEngine.onEvent('remotevideostats', function(
      stats: RemoteVideoStats
    ) {
      fire('remotevideostats', stats);
      fire('remoteVideoStats', stats);
    });

    this.rtcEngine.onEvent('remoteAudioStats', function(
      stats: RemoteAudioStats
    ) {
      fire('remoteAudioStats', stats);
    });

    this.rtcEngine.onEvent('remoteAudioTransportStats', function(
      uid: number,
      delay: number,
      lost: number,
      rxKBitRate: number
    ) {
      fire('remoteAudioTransportStats', {
        uid,
        delay,
        lost,
        rxKBitRate
      });
    });

    this.rtcEngine.onEvent('remoteVideoTransportStats', function(
      uid: number,
      delay: number,
      lost: number,
      rxKBitRate: number
    ) {
      fire('remoteVideoTransportStats', {
        uid,
        delay,
        lost,
        rxKBitRate
      });
    });

    this.rtcEngine.onEvent('audiodevicestatechanged', function(
      deviceId: string,
      deviceType: number,
      deviceState: number
    ) {
      fire('audiodevicestatechanged', deviceId, deviceType, deviceState);
      fire('audioDeviceStateChanged', deviceId, deviceType, deviceState);
    });

    // this.rtcEngine.onEvent('audiomixingfinished', function() {
    //   fire('audiomixingfinished');
    //   fire('audioMixingFinished');
    // });

    this.rtcEngine.onEvent('audioMixingStateChanged', function(
      state: number,
      err: number
    ) {
      fire('audioMixingStateChanged', state, err);
    });

    this.rtcEngine.onEvent('apicallexecuted', function(
      api: string,
      err: number
    ) {
      fire('apicallexecuted', api, err);
      fire('apiCallExecuted', api, err);
    });

    this.rtcEngine.onEvent('remoteaudiomixingbegin', function() {
      fire('remoteaudiomixingbegin');
      fire('remoteAudioMixingBegin');
    });

    this.rtcEngine.onEvent('remoteaudiomixingend', function() {
      fire('remoteaudiomixingend');
      fire('remoteAudioMixingEnd');
    });

    this.rtcEngine.onEvent('audioeffectfinished', function(soundId: number) {
      fire('audioeffectfinished', soundId);
      fire('audioEffectFinished', soundId);
    });

    this.rtcEngine.onEvent('videodevicestatechanged', function(
      deviceId: string,
      deviceType: number,
      deviceState: number
    ) {
      fire('videodevicestatechanged', deviceId, deviceType, deviceState);
      fire('videoDeviceStateChanged', deviceId, deviceType, deviceState);
    });

    this.rtcEngine.onEvent('networkquality', function(
      uid: number,
      txquality: AgoraNetworkQuality,
      rxquality: AgoraNetworkQuality
    ) {
      fire('networkquality', uid, txquality, rxquality);
      fire('networkQuality', uid, txquality, rxquality);
    });

    this.rtcEngine.onEvent('lastmilequality', function(
      quality: AgoraNetworkQuality
    ) {
      fire('lastmilequality', quality);
      fire('lastMileQuality', quality);
    });

    this.rtcEngine.onEvent('lastmileProbeResult', function(
      result: LastmileProbeResult
    ) {
      fire('lastmileProbeResult', result);
    });

    this.rtcEngine.onEvent('firstlocalvideoframe', function(
      width: number,
      height: number,
      elapsed: number
    ) {
      fire('firstlocalvideoframe', width, height, elapsed);
      fire('firstLocalVideoFrame', width, height, elapsed);
    });

    this.rtcEngine.onEvent('firstremotevideodecoded', function(
      uid: number,
      width: number,
      height: number,
      elapsed: number
    ) {
      fire('addstream', uid, elapsed);
      fire('addStream', uid, elapsed);
      fire('firstRemoteVideoDecoded', uid, width, height, elapsed);
    });

    this.rtcEngine.onEvent('videosizechanged', function(
      uid: number,
      width: number,
      height: number,
      rotation: number
    ) {
      fire('videosizechanged', uid, width, height, rotation);
      fire('videoSizeChanged', uid, width, height, rotation);
    });

    this.rtcEngine.onEvent('firstremotevideoframe', function(
      uid: number,
      width: number,
      height: number,
      elapsed: number
    ) {
      fire('firstremotevideoframe', uid, width, height, elapsed);
      fire('firstRemoteVideoFrame', uid, width, height, elapsed);
    });

    this.rtcEngine.onEvent('userjoined', function(
      uid: number,
      elapsed: number
    ) {
      console.log('user : ' + uid + ' joined.');
      fire('userjoined', uid, elapsed);
      fire('userJoined', uid, elapsed);
    });

    this.rtcEngine.onEvent('useroffline', function(
      uid: number,
      reason: number
    ) {
      fire('userOffline', uid, reason);
      if (!self.streams) {
        self.streams = new Map();
        console.log('Warning!!!!!!, streams is undefined.');
        return;
      }
      self.destroyRender(uid, "");
      self.rtcEngine.unsubscribe(uid);
      fire('removestream', uid, reason);
      fire('removeStream', uid, reason);
    });

    this.rtcEngine.onEvent('usermuteaudio', function(
      uid: number,
      muted: boolean
    ) {
      fire('usermuteaudio', uid, muted);
      fire('userMuteAudio', uid, muted);
    });

    this.rtcEngine.onEvent('usermutevideo', function(
      uid: number,
      muted: boolean
    ) {
      fire('usermutevideo', uid, muted);
      fire('userMuteVideo', uid, muted);
    });

    this.rtcEngine.onEvent('userenablevideo', function(
      uid: number,
      enabled: boolean
    ) {
      fire('userenablevideo', uid, enabled);
      fire('userEnableVideo', uid, enabled);
    });

    this.rtcEngine.onEvent('userenablelocalvideo', function(
      uid: number,
      enabled: boolean
    ) {
      fire('userenablelocalvideo', uid, enabled);
      fire('userEnableLocalVideo', uid, enabled);
    });

    this.rtcEngine.onEvent('cameraready', function() {
      fire('cameraready');
      fire('cameraReady');
    });

    this.rtcEngine.onEvent('videostopped', function() {
      fire('videostopped');
      fire('videoStopped');
    });

    this.rtcEngine.onEvent('connectionlost', function() {
      fire('connectionlost');
      fire('connectionLost');
    });

    // this.rtcEngine.onEvent('connectioninterrupted', function() {
    //   fire('connectioninterrupted');
    //   fire('connectionInterrupted');
    // });

    // this.rtcEngine.onEvent('connectionbanned', function() {
    //   fire('connectionbanned');
    //   fire('connectionBanned');
    // });

    // this.rtcEngine.onEvent('refreshrecordingservicestatus', function(status: any) {
    //   fire('refreshrecordingservicestatus', status);
    //   fire('refreshRecordingServiceStatus', status);
    // });

    this.rtcEngine.onEvent('streammessage', function(
      uid: number,
      streamId: number,
      msg: string,
      len: number
    ) {
      fire('streammessage', uid, streamId, msg, len);
      fire('streamMessage', uid, streamId, msg, len);
    });

    this.rtcEngine.onEvent('streammessageerror', function(
      uid: number,
      streamId: number,
      code: number,
      missed: number,
      cached: number
    ) {
      fire('streammessageerror', uid, streamId, code, missed, cached);
      fire('streamMessageError', uid, streamId, code, missed, cached);
    });

    this.rtcEngine.onEvent('mediaenginestartcallsuccess', function() {
      fire('mediaenginestartcallsuccess');
      fire('mediaEngineStartCallSuccess');
    });

    this.rtcEngine.onEvent('requestchannelkey', function() {
      fire('requestchannelkey');
      fire('requestChannelKey');
    });

    this.rtcEngine.onEvent('firstlocalaudioframe', function(elapsed: number) {
      fire('firstlocalaudioframe', elapsed);
      fire('firstLocalAudioFrame', elapsed);
    });

    this.rtcEngine.onEvent('firstremoteaudioframe', function(
      uid: number,
      elapsed: number
    ) {
      fire('firstremoteaudioframe', uid, elapsed);
      fire('firstRemoteAudioFrame', uid, elapsed);
    });

    this.rtcEngine.onEvent('firstRemoteAudioDecoded', function(
      uid: number,
      elapsed: number
    ) {
      fire('firstRemoteAudioDecoded', uid, elapsed);
    });

    this.rtcEngine.onEvent('remoteVideoStateChanged', function(
      uid: number,
      state: RemoteVideoState,
      reason: RemoteVideoStateReason,
      elapsed: number
    ) {
      fire('remoteVideoStateChanged', uid, state, reason, elapsed);
    });

    this.rtcEngine.onEvent('cameraFocusAreaChanged', function(
      x: number,
      y: number,
      width: number,
      height: number
    ) {
      fire('cameraFocusAreaChanged', x, y, width, height);
    });

    this.rtcEngine.onEvent('cameraExposureAreaChanged', function(
      x: number,
      y: number,
      width: number,
      height: number
    ) {
      fire('cameraExposureAreaChanged', x, y, width, height);
    });

    this.rtcEngine.onEvent('tokenPrivilegeWillExpire', function(token: string) {
      fire('tokenPrivilegeWillExpire', token);
    });

    this.rtcEngine.onEvent('streamPublished', function(
      url: string,
      error: number
    ) {
      fire('streamPublished', url, error);
    });

    this.rtcEngine.onEvent('streamUnpublished', function(url: string) {
      fire('streamUnpublished', url);
    });

    this.rtcEngine.onEvent('transcodingUpdated', function() {
      fire('transcodingUpdated');
    });

    this.rtcEngine.onEvent('streamInjectStatus', function(
      url: string,
      uid: number,
      status: number
    ) {
      fire('streamInjectStatus', url, uid, status);
    });

    this.rtcEngine.onEvent('localPublishFallbackToAudioOnly', function(
      isFallbackOrRecover: boolean
    ) {
      fire('localPublishFallbackToAudioOnly', isFallbackOrRecover);
    });

    this.rtcEngine.onEvent('remoteSubscribeFallbackToAudioOnly', function(
      uid: number,
      isFallbackOrRecover: boolean
    ) {
      fire('remoteSubscribeFallbackToAudioOnly', uid, isFallbackOrRecover);
    });

    this.rtcEngine.onEvent('microphoneEnabled', function(enabled: boolean) {
      fire('microphoneEnabled', enabled);
    });

    this.rtcEngine.onEvent('connectionStateChanged', function(
      state: ConnectionState,
      reason: ConnectionChangeReason
    ) {
      fire('connectionStateChanged', state, reason);
    });

    this.rtcEngine.onEvent('activespeaker', function(uid: number) {
      fire('activespeaker', uid);
      fire('activeSpeaker', uid);
    });

    this.rtcEngine.onEvent('clientrolechanged', function(
      oldRole: ClientRoleType,
      newRole: ClientRoleType
    ) {
      fire('clientrolechanged', oldRole, newRole);
      fire('clientRoleChanged', oldRole, newRole);
    });

    this.rtcEngine.onEvent('audiodevicevolumechanged', function(
      deviceType: MediaDeviceType,
      volume: number,
      muted: boolean
    ) {
      fire('audiodevicevolumechanged', deviceType, volume, muted);
      fire('audioDeviceVolumeChanged', deviceType, volume, muted);
    });

    this.rtcEngine.onEvent('videosourcejoinsuccess', function(uid: number) {
      fire('videosourcejoinedsuccess', uid);
      fire('videoSourceJoinedSuccess', uid);
    });

    this.rtcEngine.onEvent('videosourcerequestnewtoken', function() {
      fire('videosourcerequestnewtoken');
      fire('videoSourceRequestNewToken');
    });

    this.rtcEngine.onEvent('videosourceleavechannel', function() {
      fire('videosourceleavechannel');
      fire('videoSourceLeaveChannel');
    });

    this.rtcEngine.onEvent('localUserRegistered', function(
      uid: number,
      userAccount: string
    ) {
      fire('localUserRegistered', uid, userAccount);
    });

    this.rtcEngine.onEvent('userInfoUpdated', function(
      uid: number,
      userInfo: UserInfo
    ) {
      fire('userInfoUpdated', uid, userInfo);
    });

    this.rtcEngine.onEvent('localVideoStateChanged', function(
      localVideoState: number,
      err: number
    ) {
      fire('localVideoStateChanged', localVideoState, err);
    });

    this.rtcEngine.onEvent('localAudioStateChanged', function(
      state: number,
      err: number
    ) {
      fire('localAudioStateChanged', state, err);
    });

    this.rtcEngine.onEvent('remoteAudioStateChanged', function(
      uid: number,
      state: RemoteAudioState,
      reason: RemoteAudioStateReason,
      elapsed: number
    ) {
      fire('remoteAudioStateChanged', uid, state, reason, elapsed);
    });

    this.rtcEngine.onEvent('audioMixingStateChanged', function(
      state: number,
      errorCode: number
    ) {
      fire('audioMixingStateChanged', state, errorCode);
    });

    this.rtcEngine.onEvent('channelMediaRelayState', function(
      state: ChannelMediaRelayState,
      code: ChannelMediaRelayError
    ) {
      fire('channelMediaRelayState', state, code);
    });

    this.rtcEngine.onEvent('channelMediaRelayEvent', function(
      event: ChannelMediaRelayEvent
    ) {
      fire('channelMediaRelayEvent', event);
    });

    this.rtcEngine.onEvent('rtmpStreamingStateChanged', function(url:string, state: number, errCode: number) {
      fire('rtmpStreamingStateChanged', url, state, errCode);
    })

    this.rtcEngine.onEvent('firstLocalAudioFramePublished', function(elapsed: number) {
      fire('firstLocalAudioFramePublished', elapsed);
    })

    this.rtcEngine.onEvent('firstLocalVideoFramePublished', function(elapsed: number) {
      fire('firstLocalVideoFramePublished', elapsed);
    })

    this.rtcEngine.onEvent('rtmpStreamingEvent', function(url: string, eventCode: RTMP_STREAMING_EVENT) {
      fire('rtmpStreamingEvent', url, eventCode);
    })

    this.rtcEngine.onEvent('audioPublishStateChanged', function(channel: string, oldState: STREAM_PUBLISH_STATE, newState: STREAM_PUBLISH_STATE, elapseSinceLastState: number) {
      fire('audioPublishStateChanged', channel, oldState, newState, elapseSinceLastState);
    })

    this.rtcEngine.onEvent('videoPublishStateChanged', function(channel: string, oldState: STREAM_PUBLISH_STATE, newState: STREAM_PUBLISH_STATE, elapseSinceLastState: number) {
      fire('videoPublishStateChanged', channel, oldState, newState, elapseSinceLastState);
    })

    this.rtcEngine.onEvent('audioSubscribeStateChanged', function(channel: string, uid: number, oldState: STREAM_SUBSCRIBE_STATE, newState: STREAM_SUBSCRIBE_STATE, elapseSinceLastState: number) {
      fire('audioSubscribeStateChanged', channel, uid, oldState, newState, elapseSinceLastState);
    })

    this.rtcEngine.onEvent('videoSubscribeStateChanged', function(channel: string, uid: number, oldState: STREAM_SUBSCRIBE_STATE, newState: STREAM_SUBSCRIBE_STATE, elapseSinceLastState: number) {
      fire('videoSubscribeStateChanged', channel, uid, oldState, newState, elapseSinceLastState);
    })

    this.rtcEngine.onEvent('audioRouteChanged', function(routing: AUDIO_ROUTE_TYPE) {
      fire('audioRouteChanged', routing);
    })

    this.rtcEngine.onEvent('videoBackgroundSourceEnabled', function(enabled: boolean, reason: VIDEO_BACKGROUND_SOURCE_STATE_REASON) {
      fire('videoBackgroundSourceEnabled', enabled, reason);
    })

    this.rtcEngine.registerDeliverFrame(function(infos: any) {
      self.onRegisterDeliverFrame(infos);
    });
  }

  /**
   * @private
   * @ignore
   * @param {number} type 0-local 1-remote 2-device_test 3-video_source
   * @param {number} uid uid get from native engine, differ from electron engine's uid
   */ //TODO(input)
  _getRenderers(type: number, uid: number, channelId: string | undefined): IRenderer[] | undefined {
    let channelStreams = this._getChannelRenderers(channelId || "")
    if (type < 2) {
      if (uid === 0) {
        return channelStreams.get('local');
      } else {
        return channelStreams.get(String(uid));
      }
    } else if (type === 2) {
      // return this.streams.devtest;
      console.warn('Type 2 not support in production mode.');
      return;
    } else if (type === 3) {
      return channelStreams.get('videosource');
    } else {
      console.warn('Invalid type for getRenderer, only accept 0~3.');
      return;
    }
  }
  //TODO(input)
  _getChannelRenderers(channelId: string): Map<string, IRenderer[]> {
    let channel: Map<string, IRenderer[]>;
    if(!this.streams.has(channelId)) {
      channel = new Map()
      this.streams.set(channelId, channel)
    } else {
      channel = this.streams.get(channelId) as Map<string, IRenderer[]>
    }
    return channel
  }

  /**
   * check if data is valid
   * @private
   * @ignore
   * @param {*} header
   * @param {*} ydata
   * @param {*} udata
   * @param {*} vdata
   *///TODO(input)
  _checkData(
    header: ArrayBuffer,
    ydata: ArrayBuffer,
    udata: ArrayBuffer,
    vdata: ArrayBuffer
  ) {
    if (header.byteLength != 20) {
      console.error('invalid image header ' + header.byteLength);
      return false;
    }
    if (ydata.byteLength === 20) {
      console.error('invalid image yplane ' + ydata.byteLength);
      return false;
    }
    if (udata.byteLength === 20) {
      console.error('invalid image uplanedata ' + udata.byteLength);
      return false;
    }
    if (
      ydata.byteLength != udata.byteLength * 4 ||
      udata.byteLength != vdata.byteLength
    ) {
      console.error(
        'invalid image header ' +
          ydata.byteLength +
          ' ' +
          udata.byteLength +
          ' ' +
          vdata.byteLength
      );
      return false;
    }

    return true;
  }

  /**
   * register renderer for target info
   * @private
   * @ignore
   * @param {number} infos
   */
  onRegisterDeliverFrame(infos: any) {
    const len = infos.length;
    for (let i = 0; i < len; i++) {
      const info = infos[i];
      const { type, uid, channelId, header, ydata, udata, vdata } = info;
      if (!header || !ydata || !udata || !vdata) {
        console.log(
          'Invalid data param ： ' +
            header +
            ' ' +
            ydata +
            ' ' +
            udata +
            ' ' +
            vdata
        );
        continue;
      }
      const renderers = this._getRenderers(type, uid, channelId);
      if (!renderers || renderers.length === 0) {
        console.warn(`Can't find renderer for uid : ${uid} ${channelId}`);
        continue;
      }

      if (this._checkData(header, ydata, udata, vdata)) {
        renderers.forEach(renderer => {
          renderer.drawFrame({
            header,
            yUint8Array: ydata,
            uUint8Array: udata,
            vUint8Array: vdata
          });
        })
      }
    }
  }

  /**
   * Resizes the renderer.
   *
   * When the size of the view changes, this method refresh the zoom level so
   * that video is sized appropriately while waiting for the next video frame
   * to arrive.
   *
   * Calling this method prevents a view discontinutity.
   * @param key Key for the map that store the renderers,
   * e.g, `uid` or `videosource` or `local`.
   */
  resizeRender(key: 'local' | 'videosource' | number, channelId:string | undefined) {
    let channelStreams = this._getChannelRenderers(channelId || "")
    if (channelStreams.has(String(key))) {
      const renderers = channelStreams.get(String(key)) || [];
      renderers.forEach(renderer => renderer.refreshCanvas())
    }
  }

  /**
   * Initializes the renderer.
   * @param key Key for the map that store the renderers,
   * e.g, uid or `videosource` or `local`.
   * @param view The Dom elements to render the video.
   */
  initRender(key: 'local' | 'videosource' | number, view: Element, channelId: string | undefined, options?: RendererOptions) {
    let rendererOptions = {
      append: options ? options.append : false
    }
    let channelStreams = this._getChannelRenderers(channelId || "")

    if (channelStreams.has(String(key))) {
      if(!rendererOptions.append) {
        this.destroyRender(key, channelId || "");
      } else {
        let renderers = channelStreams.get(String(key)) || []
        for(let i = 0; i < renderers.length; i++) {
          if(renderers[i].equalsElement(view)){
            console.log(`view exists in renderer list, ignore`)
            return
          }
        }
      }
    }
    channelStreams = this._getChannelRenderers(channelId || "")
    let renderer: IRenderer;
    if (this.renderMode === 1) {
      renderer = new GlRenderer();
    } else if (this.renderMode === 2) {
      renderer = new SoftwareRenderer();
    } else if (this.renderMode === 3) {
      renderer = new this.customRenderer();
    } else {
      console.warn('Unknown render mode, fallback to 1');
      renderer = new GlRenderer();
    }
    renderer.bind(view);

    if(!rendererOptions.append) {
      channelStreams.set(String(key), [renderer]);
    } else {
      let renderers = channelStreams.get(String(key)) || []
      renderers.push(renderer)
      channelStreams.set(String(key), renderers)
    }
  }
  //TODO(input)
  destroyRenderView(
    key: 'local' | 'videosource' | number, channelId: string | undefined, view: Element,
    onFailure?: (err: Error) => void
  ) {
    let channelStreams = this._getChannelRenderers(channelId || "")
    if (!channelStreams.has(String(key))) {
      return;
    }
    const renderers = channelStreams.get(String(key)) || [];
    const matchRenderers = renderers.filter(renderer => renderer.equalsElement(view))
    const otherRenderers = renderers.filter(renderer => !renderer.equalsElement(view))

    if(matchRenderers.length > 0) {
      let renderer = matchRenderers[0]
      try {
        (renderer as IRenderer).unbind();
        if(otherRenderers.length > 0) {
          // has other renderers left, update
          channelStreams.set(String(key), otherRenderers)
        } else {
          // removed renderer is the only one, remove
          channelStreams.delete(String(key));
        }
        if(channelStreams.size === 0) {
          this.streams.delete(channelId || "")
        }
      } catch (err) {
        onFailure && onFailure(err)
      }
    }

  }


  /**
   * Destroys the renderer.
   * @param key Key for the map that store the renderers,
   * e.g, `uid` or `videosource` or `local`.
   * @param onFailure The error callback for the {@link destroyRenderer}
   * method.
   */
  destroyRender(
    key: 'local' | 'videosource' | number, channelId: string | undefined,
    onFailure?: (err: Error) => void
  ) {
    let channelStreams = this._getChannelRenderers(channelId || "")
    if (!channelStreams.has(String(key))) {
      return;
    }
    const renderers = channelStreams.get(String(key)) || [];

    let exception = null
    for(let i = 0; i < renderers.length; i++) {
      let renderer = renderers[i]
      try {
        (renderer as IRenderer).unbind();
        channelStreams.delete(String(key));
        if(channelStreams.size === 0) {
          this.streams.delete(channelId || "")
        }
      } catch (err) {
        exception = err
        console.error(`${err.stack}`)
      }
    }
    if(exception) {
      onFailure && onFailure(exception)
    }
  }

  // ===========================================================================
  // BASIC METHODS
  // ===========================================================================

  /**
   * Initializes the Agora service.
   *
   * @param appid The App ID issued to you by Agora.
   * See [How to get the App ID](https://docs.agora.io/en/Agora%20Platform/token#get-an-app-id).
   * Only users in apps with the same App ID can join the same channel and
   * communicate with each other. Use an App ID to create only
   * one `AgoraRtcEngine` . To change your App ID, call `release` to destroy
   * the current `AgoraRtcEngine`e and then call `initialize` to create
   * `AgoraRtcEngine` with the new App ID.
   * @param areaCode The region for connection. This advanced feature applies
   * to scenarios that have regional restrictions. For the regions that Agora
   * supports, see {@link AREA_CODE}. After specifying the region, the SDK
   * connects to the Agora servers within that region. Note: The SDK supports
   * specify only one region.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  initialize(appid: string, areaCode: AREA_CODE = (0xFFFFFFFF)): number {
    let dllPath = path.resolve(__dirname, "../../build/Release/");
    let ret = this.rtcEngine.addDllDirectory(dllPath);
    console.log(`addDllDirectory :  ${dllPath}  ${ret}`)
    return this.rtcEngine.initialize(appid, areaCode);
  }

  /**
   * Creates and gets an `AgoraRtcChannel` object.
   *
   * To join more than one channel, call this method multiple times to create
   * as many `AgoraRtcChannel` objects as needed, and call the
   * {@link AgoraRtcChannel.joinChannel joinChannel} method of each created
   * `AgoraRtcChannel` object.
   *
   * After joining multiple channels, you can simultaneously subscribe to
   * streams of all the channels, but publish a stream in only one channel
   * at one time.
   * @param channelName The unique channel name for an Agora RTC session.
   * It must be in the string format and not exceed 64 bytes in length.
   * Supported character scopes are:
   * - All lowercase English letters: a to z.
   * - All uppercase English letters: A to Z.
   * - All numeric characters: 0 to 9.
   * - The space character.
   * - Punctuation characters and other symbols, including: "!", "#", "$",
   * "%", "&", "(", ")", "+", "-", ":", ";", "<", "=", ".", ">", "?", "@",
   * "[", "]", "^", "_", " {", "}", "|", "~", ",".
   *
   * @note
   * - This parameter does not have a default value. You must set it.
   * - Do not set it as the empty string "". Otherwise, the SDK returns
   * `ERR_REFUSED (5)`.
   *
   * @return
   * - If the method call succeeds, returns the `AgoraRtcChannel` object.
   * - If the method call fails, returns empty or `ERR_REFUSED (5)`.
   */
  createChannel(channelName: string): (AgoraRtcChannel | null) {
    let rtcChannel = this.rtcEngine.createChannel(channelName)
    if(!rtcChannel) {
      return null
    }
    return new AgoraRtcChannel(rtcChannel)
  }

  /**
   * Returns the version and the build information of the current SDK.
   * @return The version of the current SDK.
   */
  getVersion(): string {
    return this.rtcEngine.getVersion();
  }

  /**
   * Retrieves the error description.
   * @param {number} errorCode The error code.
   * @return The error description.
   */
  getErrorDescription(errorCode: number): string {
    return this.rtcEngine.getErrorDescription(errorCode);
  }

  /**
   * Gets the connection state of the SDK.
   * @return {ConnectionState} Connect states. See {@link ConnectionState}.
   */
  getConnectionState(): ConnectionState {
    return this.rtcEngine.getConnectionState();
  }

  /**
   * Allows a user to join a channel.
   *
   * Users in the same channel can talk to each other, and multiple users in
   * the same channel can start a group chat.
   * Users with different App IDs cannot call each other.You must call the
   * {@link leaveChannel} method to exit the current call
   * before entering another channel.
   *
   * This method call triggers the following callbacks:
   *
   * - The local client: joinedChannel
   * - The remote client: userJoined, if the user joining the channel is in
   * the communication(`0`) profile,
   * or is a host in the `1` (live streaming) profile.
   *
   * When the connection between the client and Agora's server is interrupted
   * due to poor network conditions,
   * the SDK tries reconnecting to the server. When the local client
   * successfully rejoins the channel, the SDK
   * triggers the rejoinedChannel callback on the local client.
   *
   * @param {string} token token The token generated at your server:
   * - For low-security requirements: You can use the temporary token
   * generated at Console. For details, see
   * [Get a temporary token](https://docs.agora.io/en/Voice/token?platform=All%20Platforms#get-a-temporary-token).
   * - For high-security requirements: Set it as the token generated at your
   * server. For details, see
   * [Get a token](https://docs.agora.io/en/Voice/token?platform=All%20Platforms#get-a-token).
   * @param {string} channel (Required) Pointer to the unique channel name for
   * the Agora RTC session in the string format smaller than 64 bytes.
   * Supported characters:
   * - The 26 lowercase English letters: a to z.
   * - The 26 uppercase English letters: A to Z.
   * - The 10 numbers: 0 to 9.
   * - The space.
   * - "!", "#", "$", "%", "&", "(", ")", "+", "-", ":", ";", "<", "=", ".",
   * ">", "?", "@", "[", "]", "^", "_", " {", "}", "|", "~", ",".
   * @param {string} info (Optional) Pointer to additional information about
   * the channel. This parameter can be set to NULL or contain channel related
   * information.
   * Other users in the channel will not receive this message.
   * @param {number} uid The User ID. A 32-bit unsigned integer with a value
   * ranging from 1 to 2<sup>32</sup>-1. The `uid` must be unique. If a `uid`
   * is not assigned (or set to 0),
   * the SDK assigns a `uid`.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *  - `ERR_INVALID_ARGUMENT (2)`
   *  - `ERR_NOT_READY (3)`
   *  - `ERR_REFUSED (5) `
   */
  joinChannel(
    token: string,
    channel: string,
    info: string,
    uid: number
  ): number {
    return this.rtcEngine.joinChannel(token, channel, info, uid);
  }

  /**
   * Allows a user to leave a channel.
   *
   * Allows a user to leave a channel, such as hanging up or exiting a call.
   * The user must call the method to end the call before
   * joining another channel after call the {@link joinChannel} method.
   * This method returns 0 if the user leaves the channel and releases all
   * resources related to the call.
   * This method call is asynchronous, and the user has not left the channel
   * when the method call returns.
   *
   * Once the user leaves the channel, the SDK triggers the leavechannel
   * callback.
   *
   * A successful leavechannel method call triggers the removeStream callback
   * for the remote client when the user leaving the channel
   * is in the Communication channel, or is a host in the `1` (live streaming)
   * profile.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  leaveChannel(): number {
    return this.rtcEngine.leaveChannel();
  }

  /**
   * Releases the AgoraRtcEngine instance.
   *
   * Once the App calls this method to release the created AgoraRtcEngine
   * instance, no other methods in the SDK
   * can be used and no callbacks can occur. To start it again, initialize
   * {@link initialize} to establish a new
   * AgoraRtcEngine instance.
   *
   * **Note**: Call this method in the subthread.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  release(): number {
    return this.rtcEngine.release();
  }

  /**
   * @deprecated This method is deprecated. Agora does not recommend using
   * this method. Use {@link setAudioProfile} instead.
   * Sets the high-quality audio preferences.
   *
   * Call this method and set all parameters before joining a channel.
   * @param {boolean} fullband Sets whether to enable/disable full-band
   * codec (48-kHz sample rate).
   * - true: Enable full-band codec.
   * - false: Disable full-band codec.
   * @param {boolean} stereo Sets whether to enable/disable stereo codec.
   * - true: Enable stereo codec.
   * - false: Disable stereo codec.
   * @param {boolean} fullBitrate Sets whether to enable/disable high-bitrate
   * mode.
   * - true: Enable high-bitrate mode.
   * - false: Disable high-bitrate mode.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setHighQualityAudioParameters(
    fullband: boolean,
    stereo: boolean,
    fullBitrate: boolean
  ): number {
    deprecate('setAudioProfile');
    return this.rtcEngine.setHighQualityAudioParameters(
      fullband,
      stereo,
      fullBitrate
    );
  }

  /**
   * Subscribes to a remote user and initializes the corresponding renderer.
   * @param {number} uid The user ID of the remote user.
   * @param {Element} view The Dom where to initialize the renderer.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */ //TODO(input)
  subscribe(uid: number, view: Element, options?: RendererOptions): number {
    this.initRender(uid, view, "", options);
    return this.rtcEngine.subscribe(uid);
  }
  //TODO(input)
  setupRemoteVideo(uid: number, view?: Element, channel?: string, options?: RendererOptions): number {
    if(view) {
      //bind
      this.initRender(uid, view, channel, options);
      return this.rtcEngine.subscribe(uid, channel);
    } else {
      //unbind
      this.destroyRender(uid, channel);
      return this.rtcEngine.unsubscribe(uid, channel);
    }
  }

  /**
   * Sets the local video view and the corresponding renderer.
   * @param {Element} view The Dom element where you initialize your view.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *///TODO(input)
  setupLocalVideo(view: Element, options?: RendererOptions): number {
    this.initRender('local', view, "", options);
    return this.rtcEngine.setupLocalVideo();
  }

  /**
   * Sets the renderer dimension of video.
   *
   * This method ONLY affects size of data sent to js layer, while native video
   * size is determined by {@link setVideoEncoderConfiguration}.
   * @param {*} rendertype The renderer type:
   * - 0: The local renderer.
   * - 1: The remote renderer.
   * - 2: The device test
   * - 3: The video source.
   * @param {*} uid The user ID of the targeted user.
   * @param {*} width The target width.
   * @param {*} height The target height.
   */
  setVideoRenderDimension(
    rendertype: number,
    uid: number,
    width: number,
    height: number
  ) {
    this.rtcEngine.setVideoRenderDimension(rendertype, uid, width, height);
  }

  /**
   * Sets the global renderer frame rate (fps).
   *
   * This method is mainly used to improve the performance of js rendering
   * once set, the video data will be sent with this frame rate. This can
   * reduce the CPU consumption of js rendering.
   * This applies to ALL views except the ones added to the high frame rate
   * stream.
   * @param {number} fps The renderer frame rate (fps).
   */
  setVideoRenderFPS(fps: number) {
    this.rtcEngine.setFPS(fps);
  }

  /**
   * Sets renderer frame rate for the high stream.
   *
   * The high stream here has nothing to do with the dual stream.
   * It means the stream that is added to the high frame rate stream by calling
   * the {@link addVideoRenderToHighFPS} method.
   *
   * This is often used when we want to set the low frame rate for most of
   * views, but high frame rate for one
   * or two special views, e.g. screen sharing.
   * @param {number} fps The renderer high frame rate (fps).
   */
  setVideoRenderHighFPS(fps: number) {
    this.rtcEngine.setHighFPS(fps);
  }

  /**
   * Adds a video stream to the high frame rate stream.
   * Streams added to the high frame rate stream will be controlled by the
   * {@link setVideoRenderHighFPS} method.
   * @param {number} uid The User ID.
   */
  addVideoRenderToHighFPS(uid: number) {
    this.rtcEngine.addToHighVideo(uid);
  }

  /**
   * Removes a stream from the high frame rate stream.
   * Streams removed from the high frame rate stream will be controlled by the
   * {@link setVideoRenderFPS} method.
   * @param {number} uid The User ID.
   */
  removeVideoRenderFromHighFPS(uid: number) {
    this.rtcEngine.removeFromHighVideo(uid);
  }

  /**
   * Sets the view content mode.
   * @param {number | 'local' | 'videosource'} uid The user ID for operating
   * streams. When setting up the view content of the remote user's stream,
   * make sure you have subscribed to that stream by calling the
   * {@link subscribe} method.
   * @param {0|1} mode The view content mode:
   * - 0: Cropped mode. Uniformly scale the video until it fills the visible
   * boundaries (cropped). One dimension of the video may have clipped
   * contents.
   * - 1: Fit mode. Uniformly scale the video until one of its dimension fits
   * the boundary (zoomed to fit). Areas that are not filled due to the
   * disparity
   * in the aspect ratio will be filled with black.
   * @return
   * - 0: Success.
   * - -1: Failure.
   */
  setupViewContentMode(
    uid: number | 'local' | 'videosource',
    mode: 0 | 1,
    channelId: string | undefined
  ): number {
    let channelStreams = this._getChannelRenderers(channelId || "")
    if (channelStreams.has(String(uid))) {
      const renderers = channelStreams.get(String(uid)) || [];
      for(let i = 0; i < renderers.length; i++) {
        let renderer = renderers[i];
        (renderer as IRenderer).setContentMode(mode);
      }
      return 0;
    } else {
      return -1;
    }
  }

  /**
   * Renews the token when the current token expires.
   *
   * The key expires after a certain period of time once the Token schema is
   * enabled when:
   * - The onError callback reports the ERR_TOKEN_EXPIRED(109) error, or
   * - The requestChannelKey callback reports the ERR_TOKEN_EXPIRED(109) error,
   * or
   * - The user receives the tokenPrivilegeWillExpire callback.
   *
   * The app should retrieve a new token from the server and then call this
   * method to renew it. Failure to do so results in the SDK disconnecting
   * from the server.
   * @param {string} newtoken The new token.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  renewToken(newtoken: string): number {
    return this.rtcEngine.renewToken(newtoken);
  }

  /**
   * Sets the channel profile.
   *
   * The AgoraRtcEngine applies different optimization according to the app
   * scenario.
   *
   * **Note**:
   * -  Call this method before the {@link joinChannel} method.
   * - Users in the same channel must use the same channel profile.
   * @param {number} profile The channel profile:
   * - 0: for communication
   * - 1: for live streaming
   * - 2: for in-game
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setChannelProfile(profile: number): number {
    return this.rtcEngine.setChannelProfile(profile);
  }

  /**
   * Sets the role of a user (live streaming only).
   *
   * This method sets the role of a user, such as a host or an audience
   * (default), before joining a channel.
   *
   * This method can be used to switch the user role after a user joins a
   * channel. In the `1` (live streaming)profile,
   * when a user switches user roles after joining a channel, a successful
   * {@link setClientRole} method call triggers the following callbacks:
   * - The local client: clientRoleChanged
   * - The remote client: userJoined
   *
   * @param {ClientRoleType} role The client role:
   *
   * - 1: The host
   * - 2: The audience
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setClientRole(role: ClientRoleType): number {
    return this.rtcEngine.setClientRole(role);
  }

  /** Sets the role of a user in interactive live streaming.
   *
   * @since v3.2.0
   *
   * You can call this method either before or after joining the channel to
   * set the user role as audience or host. If
   * you call this method to switch the user role after joining the channel,
   * the SDK triggers the following callbacks:
   * - The local client: `clientRoleChanged`.
   * - The remote client: `userJoined` or `userOffline`.
   *
   * @note
   * - This method applies to the `LIVE_BROADCASTING` profile only.
   * - The difference between this method and {@link setClientRole} is that
   * this method can set the user level in addition to the user role.
   *  - The user role determines the permissions that the SDK grants to a
   * user, such as permission to send local
   * streams, receive remote streams, and push streams to a CDN address.
   *  - The user level determines the level of services that a user can
   * enjoy within the permissions of the user's
   * role. For example, an audience can choose to receive remote streams with
   * low latency or ultra low latency. Levels
   * affect prices.
   *
   * @param role The role of a user in interactive live streaming.
   * @param options The detailed options of a user, including user level.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setClientRoleWithOptions(role: ClientRoleType, options: ClientRoleOptions): number {
    return this.rtcEngine.setClientRoleWithOptions(role, options);
  }

  /**
   * @deprecated The method is deprecated. Use
   * {@link startEchoTestWithInterval} instead.
   * Starts an audio call test.
   *
   * This method launches an audio call test to determine whether the audio
   * devices (for example, headset and speaker) and the network connection are
   * working properly.
   *
   * To conduct the test, the user speaks, and the recording is played back
   * within 10 seconds.
   *
   * If the user can hear the recording in 10 seconds, it indicates that
   * the audio devices
   * and network connection work properly.
   *
   * **Note**:
   * - Call this method before the {@link joinChannel} method.
   * - After calling this method, call the {@link stopEchoTest} method to end
   * the test. Otherwise, the app cannot run the next echo test,
   * nor can it call the {@link joinChannel} method to start a new call.
   * - In the `1` (live streaming) profile, only hosts can call this method.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startEchoTest(): number {
    deprecate('startEchoTestWithInterval');
    return this.rtcEngine.startEchoTest();
  }

  /**
   * Stops the audio call test.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopEchoTest(): number {
    return this.rtcEngine.stopEchoTest();
  }

  /**
   * Starts an audio call test.
   *
   * This method starts an audio call test to determine whether the audio
   * devices
   * (for example, headset and speaker) and the network connection are working
   * properly.
   *
   * In the audio call test, you record your voice. If the recording plays back
   * within the set time interval,
   * the audio devices and the network connection are working properly.
   *
   * **Note**:
   * - Call this method before the {@link joinChannel} method.
   * - After calling this method, call the {@link stopEchoTest} method to end
   * the test. Otherwise, the app cannot run the next echo test,
   * nor can it call the {@link joinChannel} method to start a new call.
   * - In the `1` (live streaming) profile, only hosts can call this method.
   * @param interval The time interval (s) between when you speak and when the
   * recording plays back.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startEchoTestWithInterval(interval: number): number {
    return this.rtcEngine.startEchoTestWithInterval(interval);
  }
  /**
   * @since v3.0.0
   *
   * Adds a watermark image to the local video.
   *
   * This method adds a PNG watermark image to the local video in a live
   * broadcast. Once the watermark image is added, all the audience in the
   * channel (CDN audience included), and the recording device can see and
   * capture it. Agora supports adding only one watermark image onto the local
   * video, and the newly watermark image replaces the previous one.
   *
   * The watermark position depends on the settings in the
   * {@link setVideoEncoderConfiguration} method:
   * - If the orientation mode of the encoding video is LANDSCAPE, the
   * landscape mode in ADAPTIVE, the watermark uses the landscape orientation.
   * - If the orientation mode of the encoding video is PORTRAIT, or the
   * portrait mode in ADAPTIVE, the watermark uses the portrait orientation.
   * - hen setting the watermark position, the region must be less than the
   * dimensions set in the {@link setVideoEncoderConfiguration} method.
   * Otherwise, the watermark image will be cropped.
   *
   * @note
   * - Ensure that you have called {@link enableVideo} before this method.
   * - If you only want to add a watermark image to the local video for the
   * audience in the CDN live streaming channel to see and capture, you can
   * call this method or {@link setLiveTranscoding}.
   * - This method supports adding a watermark image in the PNG file format
   * only. Supported pixel formats of the PNG image are RGBA, RGB, Palette,
   * Gray, and Alpha_gray.
   * - If the dimensions of the PNG image differ from your settings in this
   * method, the image will be cropped or zoomed to conform to your settings.
   * - If you have enabled the local video preview by calling
   * {@link startPreview}, you can use the `visibleInPreview` member in the
   * WatermarkOptions class to set whether or not the watermark is visible in
   * preview.
   * - If you have enabled the mirror mode for the local video, the watermark
   * on the local video is also mirrored. To avoid mirroring the watermark,
   * Agora recommends that you do not use the mirror and watermark functions
   * for the local video at the same time. You can implement the watermark
   * function in your application layer.
   * @param path The local file path of the watermark image to be added. This
   * method supports adding a watermark image from the local absolute or
   * relative file path.
   * @param options The watermark's options. See {@link WatermarkOptions}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  addVideoWatermark(path:string, options: WatermarkOptions){
    return this.rtcEngine.addVideoWatermark(path, options)
  }
  /**
   * Removes the watermark image from the video stream added by the
   * {@link addVideoWatermark} method.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  clearVideoWatermarks(){
    return this.rtcEngine.clearVideoWatermarks();
  }

  /**
   * Enables the network connection quality test.
   *
   * This method tests the quality of the users' network connections and is
   * disabled by default.
   *
   * Before users join a channel or before an audience switches to a host,
   * call this method to check the uplink network quality.
   *
   * This method consumes additional network traffic, which may affect the
   * communication quality.
   *
   * Call the {@link disableLastmileTest} method to disable this test after
   * receiving the lastMileQuality callback, and before the user joins
   * a channel or switches the user role.
   * @note
   * - Do not call any other methods before receiving the
   * lastMileQuality callback. Otherwise,
   * the callback may be interrupted by other methods, and hence may not be
   * triggered.
   * - A host should not call this method after joining a channel
   * (when in a call).
   * - If you call this method to test the last-mile quality, the SDK consumes
   * the bandwidth of a video stream, whose bitrate corresponds to the bitrate
   * you set in the {@link setVideoEncoderConfiguration} method. After you
   * join the channel, whether you have called the {@link disableLastmileTest}
   * method or not, the SDK automatically stops consuming the bandwidth.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableLastmileTest(): number {
    return this.rtcEngine.enableLastmileTest();
  }

  /**
   * This method disables the network connection quality test.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  disableLastmileTest(): number {
    return this.rtcEngine.disableLastmileTest();
  }

  /**
   * Starts the last-mile network probe test before
   * joining a channel to get the uplink and downlink last-mile network
   * statistics,
   * including the bandwidth, packet loss, jitter, and average round-trip
   * time (RTT).
   *
   * Once this method is enabled, the SDK returns the following callbacks:
   * - `lastMileQuality`: the SDK triggers this callback within two
   * seconds depending on the network conditions.
   * This callback rates the network conditions with a score and is more
   * closely linked to the user experience.
   * - `lastmileProbeResult`: the SDK triggers this callback within
   * 30 seconds depending on the network conditions.
   * This callback returns the real-time statistics of the network conditions
   * and is more objective.
   *
   * Call this method to check the uplink network quality before users join
   * a channel or before an audience switches to a host.
   *
   * @note
   * - This method consumes extra network traffic and may affect communication
   * quality. We do not recommend calling this method together with
   * {@link enableLastmileTest}.
   * - Do not call other methods before receiving the lastMileQuality and
   * lastmileProbeResult callbacks. Otherwise, the callbacks may be interrupted
   * by other methods.
   * - In the `1` (live streaming) profile, a host should not call this method after
   * joining a channel.
   *
   * @param {LastmileProbeConfig} config The configurations of the last-mile
   * network probe test. See {@link LastmileProbeConfig}.
   */
  startLastmileProbeTest(config: LastmileProbeConfig): number {
    return this.rtcEngine.startLastmileProbeTest(config);
  }

  /**
   * Stops the last-mile network probe test.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopLastmileProbeTest(): number {
    return this.rtcEngine.stopLastmileProbeTest();
  }

  /**
   * Enables the video module.
   *
   * You can call this method either before joining a channel or during a call.
   * If you call this method before joining a channel,
   * the service starts in the video mode. If you call this method during an
   * audio call, the audio mode switches to the video mode.
   *
   * To disable the video, call the {@link disableVideo} method.
   *
   * **Note**:
   * - This method affects the internal engine and can be called after calling
   * the {@link leaveChannel} method. You can call this method either before
   * or after joining a channel.
   * - This method resets the internal engine and takes some time to take
   * effect. We recommend using the following API methods to control the video
   * engine modules separately:
   *   - {@link enableLocalVideo}: Whether to enable the camera to create the
   * local video stream.
   *   - {@link muteLocalVideoStream}: Whether to publish the local video
   * stream.
   *   - {@link muteLocalVideoStream}: Whether to publish the local video
   * stream.
   *   - {@link muteAllRemoteVideoStreams}: Whether to subscribe to and play
   * all remote video streams.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableVideo(): number {
    return this.rtcEngine.enableVideo();
  }

  /**
   * Disables the video module.
   *
   * You can call this method before joining a channel or during a call. If you
   * call this method before joining a channel,
   * the service starts in audio mode. If you call this method during a video
   * call, the video mode switches to the audio mode.
   *
   * To enable the video mode, call the {@link enableVideo} method.
   *
   * **Note**:
   * - This method affects the internal engine and can be called after calling
   * the {@link leaveChannel} method. You can call this method either before
   * or after joining a channel.
   * - This method resets the internal engine and takes some time to take
   * effect. We recommend using the following API methods to control the video
   * engine modules separately:
   *   - {@link enableLocalVideo}: Whether to enable the camera to create the
   * local video stream.
   *   - {@link muteLocalVideoStream}: Whether to publish the local video
   * stream.
   *   - {@link muteLocalVideoStream}: Whether to publish the local video
   * stream.
   *   - {@link muteAllRemoteVideoStreams}: Whether to subscribe to and play
   * all remote video streams.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  disableVideo(): number {
    return this.rtcEngine.disableVideo();
  }

  /**
   * Starts the local video preview before joining a channel.
   *
   * Before starting the preview, always call {@link setupLocalVideo} to set
   * up the preview window and configure the attributes,
   * and also call the {@link enableVideo} method to enable video.
   *
   * If startPreview is called to start the local video preview before
   * calling {@link joinChannel} to join a channel, the local preview
   * remains after after you call {@link leaveChannel} to leave the channel.
   * Call {@link stopPreview} to disable the local preview.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startPreview(): number {
    return this.rtcEngine.startPreview();
  }

  /**
   * Stops the local video preview and closes the video.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopPreview(): number {
    return this.rtcEngine.stopPreview();
  }

  /**
   * @deprecated This method is deprecated. Use
   * {@link setVideoEncoderConfiguration} instead.
   *
   * Sets the video profile.
   *
   * @param {VIDEO_PROFILE_TYPE} profile The video profile. See
   * {@link VIDEO_PROFILE_TYPE}.
   * @param {boolean} [swapWidthAndHeight = false] Whether to swap width and
   * height:
   * - true: Swap the width and height.
   * - false: Do not swap the width and height.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setVideoProfile(
    profile: VIDEO_PROFILE_TYPE,
    swapWidthAndHeight: boolean = false
  ): number {
    return this.rtcEngine.setVideoProfile(profile, swapWidthAndHeight);
  }

  /**
   * Sets the camera capturer configuration.
   *
   * For a video call or live streaming, generally the SDK controls the camera
   * output parameters.
   * When the default camera capture settings do not meet special requirements
   * or cause performance problems, we recommend using this method to set the
   * camera capture preference:
   * - If the resolution or frame rate of the captured raw video data are
   * higher than those set by {@link setVideoEncoderConfiguration},
   * processing video frames requires extra CPU and RAM usage and degrades
   * performance. We recommend setting config as
   * CAPTURER_OUTPUT_PREFERENCE_PERFORMANCE(1) to avoid such problems.
   * - If you do not need local video preview or are willing to sacrifice
   * preview quality,
   * we recommend setting config as CAPTURER_OUTPUT_PREFERENCE_PERFORMANCE(1)
   * to optimize CPU and RAM usage.
   * - If you want better quality for the local video preview, we recommend
   * setting config as CAPTURER_OUTPUT_PREFERENCE_PREVIEW(2).
   * **Note**: Call this method before enabling the local camera. That said,
   * you can call this method before calling {@link joinChannel},
   * {@link enableVideo}, or {@link enableLocalVideo},
   * depending on which method you use to turn on your local camera.
   * @param {CameraCapturerConfiguration} config The camera capturer
   * configuration. See {@link CameraCapturerConfiguration}.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setCameraCapturerConfiguration(config: CameraCapturerConfiguration) {
    return this.rtcEngine.setCameraCapturerConfiguration(config);
  }

  /**
   * Sets the video encoder configuration.
   *
   * Each video encoder configuration corresponds to a set of video parameters,
   * including the resolution, frame rate, bitrate, and video orientation.
   * The parameters specified in this method are the maximum values under ideal
   * network conditions. If the video engine cannot render the video using
   * the specified parameters due to poor network conditions, the parameters
   * further down the list are considered until a successful configuration is
   * found.
   *
   * If you do not set the video encoder configuration after joining the
   * channel, you can call this method before calling the {@link enableVideo}
   * method to reduce the render time of the first video frame.
   * @param {VideoEncoderConfiguration} config The local video encoder
   * configuration. See {@link VideoEncoderConfiguration}.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setVideoEncoderConfiguration(config: VideoEncoderConfiguration): number {
    const {
      width = 640,
      height = 480,
      frameRate = 15,
      minFrameRate = -1,
      bitrate = 0,
      minBitrate = -1,
      orientationMode = 0,
      degradationPreference = 0,
      mirrorMode = 0
    } = config;
    return this.rtcEngine.setVideoEncoderConfiguration({
      width,
      height,
      frameRate,
      minFrameRate,
      bitrate,
      minBitrate,
      orientationMode,
      degradationPreference,
      mirrorMode
    });
  }

  /**
   * Enables/Disables image enhancement and sets the options.
   *
   * @since v3.0.0 for Windows
   * @since v3.2.0 for macOS
   *
   * @note Call this method after calling the {@link enableVideo} method.
   *
   * @param {boolean} enable Sets whether or not to enable image enhancement:
   * - true: Enables image enhancement.
   * - false: Disables image enhancement.
   * @param {Object} options The image enhancement options. It contains the
   * following parameters:
   * @param {number} options.lighteningContrastLevel The contrast
   * level:
   * - `0`: Low contrast level.
   * - `1`: (Default) Normal contrast level.
   * - `2`: High contrast level.
   * @param {number} options.lighteningLevel The brightness level. The value
   * ranges from 0.0 (original) to 1.0.
   * @param {number} options.smoothnessLevel The sharpness level. The value
   * ranges between 0 (original) and 1. This parameter is usually used to
   * remove blemishes.
   * @param {number} options.rednessLevel The redness level. The value ranges
   * between 0 (original) and 1. This parameter adjusts the red saturation
   * level.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setBeautyEffectOptions(
    enable: boolean,
    options: {
      lighteningContrastLevel: 0 | 1 | 2;
      lighteningLevel: number;
      smoothnessLevel: number;
      rednessLevel: number;
    }
  ): number {
    return this.rtcEngine.setBeautyEffectOptions(enable, options);
  }

  /**
   * Sets the priority of a remote user's media stream.
   *
   * Use this method with the {@link setRemoteSubscribeFallbackOption} method.
   * If the fallback function is enabled for a subscribed stream, the SDK
   * ensures
   * the high-priority user gets the best possible stream quality.
   *
   * **Note**: The Agora SDK supports setting userPriority as high for one
   * user only.
   * @param {number} uid The ID of the remote user.
   * @param {Priority} priority The priority of the remote user. See {@link Priority}.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setRemoteUserPriority(uid: number, priority: Priority) {
    return this.rtcEngine.setRemoteUserPriority(uid, priority);
  }

  /**
   * Enables the audio module.
   *
   * The audio module is enabled by default.
   *
   * **Note**:
   * - This method affects the internal engine and can be called after calling
   * the {@link leaveChannel} method. You can call this method either before
   * or after joining a channel.
   * - This method resets the internal engine and takes some time to take
   * effect. We recommend using the following API methods to control the
   * audio engine modules separately:
   *   - {@link enableLocalAudio}: Whether to enable the microphone to create
   * the local audio stream.
   *   - {@link muteLocalAudioStream}: Whether to publish the local audio
   * stream.
   *   - {@link muteRemoteAudioStream}: Whether to subscribe to and play the
   * remote audio stream.
   *   - {@link muteAllRemoteAudioStreams}: Whether to subscribe to and play
   * all remote audio streams.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableAudio(): number {
    return this.rtcEngine.enableAudio();
  }

  /**
   * Disables the audio module.
   *
   * **Note**:
   * - This method affects the internal engine and can be called after calling
   * the {@link leaveChannel} method. You can call this method either before
   * or after joining a channel.
   * - This method resets the internal engine and takes some time to take
   * effect. We recommend using the following API methods to control the audio
   * engine modules separately:
   *   - {@link enableLocalAudio}: Whether to enable the microphone to create
   * the local audio stream.
   *   - {@link muteLocalAudioStream}: Whether to publish the local audio
   * stream.
   *   - {@link muteRemoteAudioStream}: Whether to subscribe to and play the
   * remote audio stream.
   *   - {@link muteAllRemoteAudioStreams}: Whether to subscribe to and play
   * all remote audio streams.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  disableAudio(): number {
    return this.rtcEngine.disableAudio();
  }

  /**
   * Sets audio parameters and application scenarios.
   *
   * **Note**:
   * - This method must be called before the {@link joinChannel} method.
   * - In the communication(`0`) and `1` (live streaming) profiles, the bitrate
   * may be different from your settings due to network self-adaptation.
   * - In scenarios requiring high-quality audio, for example, a music
   * teaching scenario, we recommend setting profile
   * as `4` and  scenario as `3`.
   *
   * @param {number} profile Sets the sample rate, bitrate, encoding mode,
   * and the number of channels.
   * - 0: Default audio profile.
   *   - For the `1` (live streaming) profile: A sample rate of 48 KHz, music
   * encoding, mono, and a bitrate of up to 64 Kbps.
   *   - For the communication(`0`) profile:
   *      - macOS: A sample rate of 32 KHz, music encoding, mono, and a
   * bitrate of up to 18 Kbps.
   *      - Windows: A sample rate of 16 KHz, music encoding, mono, and a
   * bitrate of up to 16 Kbps.
   * - 1: Speech standard. A sample rate of 32 kHz, audio encoding, mono, and
   * a bitrate of up to 18 Kbps.
   * - 2: Music standard. A sample rate of 48 kHz, music encoding, mono, and
   * a bitrate of up to 48 Kbps.
   * - 3: Music standard stereo. A sample rate of 48 kHz, music encoding,
   * stereo, and a bitrate of up to 56 Kbps.
   * - 4: Music high quality. A sample rate of 48 kHz, music encoding, mono,
   * and a bitrate of up to 128 Kbps.
   * - 5: Music high quality stereo. A sample rate of 48 kHz, music encoding,
   * stereo, and a bitrate of up to 192 Kbps.
   * - 6: IOT.
   * @param {number} scenario Sets the audio application scenario.
   * - 0: (Default) Standard audio scenario.
   * - 1: Entertainment scenario where users need to frequently switch the
   * user role.
   * - 2: Education scenario where users want smoothness and stability.
   * - 3: High-quality audio chatroom scenario where hosts mainly play music.
   * - 4: Showroom scenario where a single host wants high-quality audio.
   * - 5: Gaming scenario for group chat that only contains the human voice.
   * - 8: Meeting scenario that mainly contains the human voice.
   *
   * Under different audio scenarios, the device uses different volume types.
   * For details, see
   * [What is the difference between the in-call volume and the media volume?](https://docs.agora.io/en/faq/system_volume).
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioProfile(
    profile: 0 | 1 | 2 | 3 | 4 | 5,
    scenario: 0 | 1 | 2 | 3 | 4 | 5 | 8
  ): number {
    return this.rtcEngine.setAudioProfile(profile, scenario);
  }

  /**
   * @deprecated This method is deprecated. Use
   * {@link setCameraCapturerConfiguration} and
   * {@link setVideoEncoderConfiguration} instead.
   * Sets the preference option for the video quality (live streaming only).
   * @param {boolean} preferFrameRateOverImageQuality Sets the video quality
   * preference:
   * - true: Frame rate over image quality.
   * - false: (Default) Image quality over frame rate.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setVideoQualityParameters(preferFrameRateOverImageQuality: boolean): number {
    return this.rtcEngine.setVideoQualityParameters(
      preferFrameRateOverImageQuality
    );
  }

  /**
   * @deprecated This method is deprecated from v3.2.0. Use the
   * {@link enableEncryption} method instead.
   *
   * Enables built-in encryption with an encryption password before joining
   * a channel.
   *
   * All users in a channel must set the same encryption password.
   * The encryption password is automatically cleared once a user has left
   * the channel.
   * If the encryption password is not specified or set to empty, the
   * encryption function will be disabled.
   *
   * **Note**:
   * - For optimal transmission, ensure that the encrypted data size does not
   * exceed the original data size + 16 bytes. 16 bytes is the maximum padding
   * size for AES encryption.
   * - Do not use this method for CDN live streaming.
   * @param {string} secret Encryption Password
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setEncryptionSecret(secret: string): number {
    return this.rtcEngine.setEncryptionSecret(secret);
  }

  /**
   * Sets the built-in encryption mode.
   *
   * @depercated This method is deprecated from v3.2.0. Use
   * the {@link enableEncryption} method instead.
   *
   * The Agora SDK supports built-in encryption, which is set to aes-128-xts
   * mode by default.
   * Call this method to set the encryption mode to use other encryption modes.
   * All users in the same channel must use the same encryption mode and
   * password.
   *
   * Refer to the information related to the AES encryption algorithm on the
   * differences between the encryption modes.
   *
   * **Note**: Call the {@link setEncryptionSecret} method before calling
   * this method.
   * @param mode Sets the encryption mode:
   * - "aes-128-xts": 128-bit AES encryption, XTS mode.
   * - "aes-128-ecb": 128-bit AES encryption, ECB mode.
   * - "aes-256-xts": 256-bit AES encryption, XTS mode.
   * - "": When encryptionMode is set as null, the encryption is in
   * “aes-128-xts” by default.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setEncryptionMode(mode: string): number {
    return this.rtcEngine.setEncryptionMode(mode);
  }

  /**
   * Stops/Resumes sending the local audio stream.
   *
   * A successful muteLocalAudioStream method call triggers the userMuteAudio
   * callback on the remote client.
   *
   * If you call {@link setChannelProfile} after this method, the SDK resets
   * whether or not to mute the local audio according to the channel profile
   * and user role. Therefore, we recommend calling this method after the
   * {@link setChannelProfile} method.
   *
   * **Note**: muteLocalAudioStream(true) does not disable the microphone and
   * thus does not affect any ongoing recording.
   * @param {boolean} mute Sets whether to send/stop sending the local audio
   * stream:
   * - true: Stop sending the local audio stream.
   * - false: (Default) Send the local audio stream.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  muteLocalAudioStream(mute: boolean): number {
    return this.rtcEngine.muteLocalAudioStream(mute);
  }

  /**
   * Stops/Resumes receiving all remote audio streams.
   * @param {boolean} mute Sets whether to receive/stop receiving all remote
   * audio streams:
   * - true: Stop receiving all remote audio streams.
   * - false: (Default) Receive all remote audio streams.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  muteAllRemoteAudioStreams(mute: boolean): number {
    return this.rtcEngine.muteAllRemoteAudioStreams(mute);
  }

  /**
   * Sets whether to receive all remote audio streams by default.
   *
   * You can call this method either before or after joining a channel. If you
   * call `setDefaultMuteAllRemoteAudioStreams(true)` after joining a channel,
   * you will not receive the audio streams of any subsequent user.
   *
   * @note If you want to resume receiving the audio stream, call
   * {@link muteRemoteAudioStream}(false), and specify the ID of the remote
   * user whose audio stream you want to receive. To resume receiving
   * the audio streams
   * of multiple remote users, call {@link muteRemoteAudioStream}(false) as
   * many times. Calling `setDefaultMuteAllRemoteAudioStreams(false)` resumes
   * receiving the audio streams of subsequent users only.
   * @param {boolean} mute Sets whether or not to receive/stop receiving all
   * remote audio streams by default:
   * - true: Stop receiving all remote audio streams by default.
   * - false: (Default) Receive all remote audio streams by default.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setDefaultMuteAllRemoteAudioStreams(mute: boolean): number {
    return this.rtcEngine.setDefaultMuteAllRemoteAudioStreams(mute);
  }

  /**
   * Stops/Resumes receiving a specified audio stream.
   * @param {number} uid ID of the specified remote user.
   * @param {boolean} mute Sets whether to receive/stop receiving the specified
   * remote user's audio stream:
   * - true: Stop receiving the specified remote user’s audio stream.
   * - false: (Default) Receive the specified remote user’s audio stream.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  muteRemoteAudioStream(uid: number, mute: boolean): number {
    return this.rtcEngine.muteRemoteAudioStream(uid, mute);
  }

  /**
   * Stops/Resumes sending the local video stream.
   *
   * A successful muteLocalVideoStream method call triggers the userMuteVideo
   * callback on the remote client.
   *
   * If you call {@link setChannelProfile} after this method, the SDK resets
   * whether or not to mute the local video according to the channel profile
   * and user role. Therefore, we recommend calling this method after the
   * {@link setChannelProfile} method.
   *
   * **Note**: muteLocalVideoStream(true) does not disable the camera and thus
   * does not affect the retrieval of the local video streams.
   * @param {boolean} mute Sets whether to send/stop sending the local video
   * stream:
   * - true: Stop sending the local video stream.
   * - false: (Default) Send the local video stream.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  muteLocalVideoStream(mute: boolean): number {
    return this.rtcEngine.muteLocalVideoStream(mute);
  }

  /**
   * Disables/Re-enables the local video capture.
   *
   * This method disables or re-enables the local video capturer, and does not
   * affect receiving the remote video stream.
   *
   * After you call the {@link enableVideo} method, the local video capturer
   * is enabled
   * by default. You can call enableLocalVideo(false) to disable the local
   * video capturer. If you want to re-enable it, call enableLocalVideo(true).
   *
   * After the local video capturer is successfully disabled or re-enabled,
   * the SDK triggers the userEnableVideo callback on the remote client.
   *
   * @param {boolean} enable Sets whether to disable/re-enable the local video,
   * including the capturer, renderer, and sender:
   * - true: (Default) Re-enable the local video.
   * - false: Disable the local video. Once the local video is disabled, the
   * remote users can no longer receive the video stream of this user,
   * while this user can still receive the video streams of other remote users.
   * When you set enabled as false, this method does not require a local
   * camera.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableLocalVideo(enable: boolean): number {
    return this.rtcEngine.enableLocalVideo(enable);
  }

  /**
   * Enables/Disables the local audio capture.
   *
   * The audio function is enabled by default. This method disables/re-enables
   * the local audio function, that is, to stop or restart local audio capture
   * and processing.
   *
   * This method does not affect receiving or playing the remote audio streams,
   * and enableLocalAudio(false) is applicable to scenarios where the user
   * wants to receive remote
   * audio streams without sending any audio stream to other users in the
   * channel.
   *
   * The SDK triggers the microphoneEnabled callback once the local audio
   * function is disabled or re-enabled.
   *
   * @param {boolean} enable Sets whether to disable/re-enable the local audio
   * function:
   * - true: (Default) Re-enable the local audio function, that is, to start
   * local audio capture and processing.
   * - false: Disable the local audio function, that is, to stop local audio
   * capture and processing.
   *
   * @note This method is different from the {@link muteLocalAudioStream}
   * method:
   *  - enableLocalAudio: If you disable or re-enable local audio recording
   * using the enableLocalAudio method, the local user may hear a pause in the
   * remote audio playback.
   *  - {@link }muteLocalAudioStream: Stops/Continues sending the local audio
   * streams and the local user will not hear a pause in the remote audio
   * playback.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableLocalAudio(enable: boolean): number {
    return this.rtcEngine.enableLocalAudio(enable);
  }

  /**
   * Stops/Resumes receiving all remote video streams.
   *
   * @param {boolean} mute Sets whether to receive/stop receiving all remote
   * video streams:
   * - true: Stop receiving all remote video streams.
   * - false: (Default) Receive all remote video streams.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  muteAllRemoteVideoStreams(mute: boolean): number {
    return this.rtcEngine.muteAllRemoteVideoStreams(mute);
  }

  /**
   * Sets whether to receive all remote video streams by default.
   *
   * You can call this method either before or after joining a channel. If you
   * call `setDefaultMuteAllRemoteVideoStreams(true)` after joining a channel,
   * you will not receive the video stream of any subsequent user.
   *
   * @note If you want to resume receiving the video stream, call
   * {@link muteRemoteVideoStream}(false), and specify the ID of the remote
   * user whose audio stream you want to receive. To resume receiving
   * the audio streams
   * of multiple remote users, call {@link muteRemoteVideoStream}(false) as
   * many times. Calling `setDefaultMuteAllRemoteVideoStreams(false)` resumes
   * receiving the audio streams of subsequent users only.
   *
   * @param {boolean} mute Sets whether to receive/stop receiving all remote
   * video streams by default:
   * - true: Stop receiving all remote video streams by default.
   * - false: (Default) Receive all remote video streams by default.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setDefaultMuteAllRemoteVideoStreams(mute: boolean): number {
    return this.rtcEngine.setDefaultMuteAllRemoteVideoStreams(mute);
  }

  /**
   * Enables the `groupAudioVolumeIndication` callback at a set time interval to
   * report on which users are speaking and the speakers' volume.
   *
   * Once this method is enabled, the SDK returns the volume indication in the
   * groupAudioVolumeIndication callback at the set time interval,
   * regardless of whether any user is speaking in the channel.
   *
   * @param {number} interval Sets the time interval between two consecutive
   * volume indications:
   * - ≤ 0: Disables the volume indication.
   * - &gt; 0: Time interval (ms) between two consecutive volume indications.
   * We recommend setting interval &ge; 200 ms.
   * @param {number} smooth The smoothing factor sets the sensitivity of the
   * audio volume indicator. The value ranges between 0 and 10.
   * The greater the value, the more sensitive the indicator. The recommended
   * value is 3.
   * @param {boolean} report_vad
   * - `true`: Enable the voice activity detection of the local user. Once it is
   * enabled, `vad` in the `groupAudioVolumeIndication` callback reports
   * the voice activity status of the local user.
   * - `false`: (Default) Disables the voice activity detection of the local user.
   * Once it is disabled, `vad` in the `groupAudioVolumeIndication` callback
   * does not report the voice activity status of the local
   * user, except for scenarios where the engine automatically detects
   * the voice activity of the local user.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableAudioVolumeIndication(interval: number, smooth: number, report_vad: boolean = false): number {
    return this.rtcEngine.enableAudioVolumeIndication(interval, smooth, report_vad);
  }

  /**
   * Stops/Resumes receiving a specified remote user's video stream.
   * @param {number} uid User ID of the specified remote user.
   * @param {boolean} mute Sets whether to receive/stop receiving a specified
   * remote user's video stream:
   * - true: Stop receiving a specified remote user’s video stream.
   * - false: (Default) Receive a specified remote user’s video stream.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  muteRemoteVideoStream(uid: number, mute: boolean): number {
    return this.rtcEngine.muteRemoteVideoStream(uid, mute);
  }

  /**
   * @deprecated This method is deprecated. Use {@link disableAudio} instead.
   * Disables the audio function in the channel.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  pauseAudio() {
    deprecate('disableAudio');
    return this.rtcEngine.pauseAudio();
  }

  /**
   * @deprecated  This method is deprecated. Use {@link enableAudio} instead.
   * Resumes the audio function in the channel.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  resumeAudio() {
    deprecate('enableAudio');
    return this.rtcEngine.resumeAudio();
  }

  /**
   * Specifies an SDK output log file.
   *
   * The log file records all log data for the SDK’s operation. Ensure that
   * the directory for the log file exists and is writable.
   *
   * @param {string} filepath File path of the log file. The string of the
   * log file is in UTF-8.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setLogFile(filepath: string): number {
    return this.rtcEngine.setLogFile(filepath);
  }

  /** Sets the size of a log file that the SDK outputs.
   *
   *
   * @note If you want to set the log file size, ensure that you call
   * this method before {@link setLogFile}, or the logs are cleared.
   *
   * By default, the SDK outputs five log files, `agorasdk.log`,
   * `agorasdk_1.log`, `agorasdk_2.log`, `agorasdk_3.log`, `agorasdk_4.log`,
   * each with a default size of 1024 KB.
   * These log files are encoded in UTF-8. The SDK writes the latest logs in
   * `agorasdk.log`. When `agorasdk.log` is full, the SDK deletes the log
   * file with the earliest
   * modification time among the other four, renames `agorasdk.log` to the
   * name of the deleted log file, and create a new `agorasdk.log` to record
   * latest logs.
   *
   * Related APIs:
   * - {@link setLogFile}
   * - {@link setLogFilter}
   *
   * @param size The size (KB) of a log file. The default value is 1024 KB.
   * If you set `size` to 1024 KB,
   * the SDK outputs at most 5 MB log files; if you set it to less than
   * 1024 KB, the maximum size of a log file is still 1024 KB.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setLogFileSize(size: number): number {
    return this.rtcEngine.setLogFileSize(size);
  }

  /**
   * Specifies an SDK output log file for the video source object.
   *
   * **Note**: Call this method after the {@link videoSourceInitialize} method.
   * @param {string} filepath filepath of log. The string of the log file is
   * in UTF-8.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceSetLogFile(filepath: string) {
    return this.rtcEngine.videoSourceSetLogFile(filepath);
  }

  /**
   * Sets the output log level of the SDK.
   *
   * You can use one or a combination of the filters. The log level follows
   * the sequence of OFF, CRITICAL, ERROR, WARNING, INFO, and DEBUG.
   * Choose a level to see the logs preceding that level. For example, if you
   * set the log level to WARNING, you see the logs within levels CRITICAL,
   * ERROR, and WARNING.
   * @param {number} filter Sets the filter level:
   * - `0`: Do not output any log.
   * - `0x080f`: Output all the API logs. Set your log filter
   * as DEBUG if you want to get the most complete log file.
   * - `0x000f`: Output logs of the CRITICAL, ERROR, WARNING and
   * INFO level. We recommend setting your log filter as this level.
   * - `0x000e`: Output logs of the CRITICAL, ERROR and
   * WARNING level.
   * - `0x000c`: Output logs of the CRITICAL and ERROR level.
   * - `0x0008`: Output logs of the CRITICAL level.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setLogFilter(filter: number): number {
    return this.rtcEngine.setLogFilter(filter);
  }

  /**
   * Enables/Disables the dual video stream mode.
   *
   * If dual-stream mode is enabled, the receiver can choose to receive the
   * high stream (high-resolution high-bitrate video stream)
   * or low stream (low-resolution low-bitrate video stream) video.
   * @param {boolean} enable Sets the stream mode:
   * - true: Dual-stream mode.
   * - false: (Default) Single-stream mode.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableDualStreamMode(enable: boolean): number {
    return this.rtcEngine.enableDualStreamMode(enable);
  }

  /**
   * Sets the stream type of the remote video.
   *
   * Under limited network conditions, if the publisher has not disabled the
   * dual-stream mode using {@link enableDualStreamMode}(`false`), the receiver
   * can choose to receive either the high-video stream (the high resolution,
   * and high bitrate video stream) or the low-video stream (the low
   * resolution, and low bitrate video stream).
   *
   * By default, users receive the high-video stream. Call this method if you
   * want to switch to the low-video stream. This method allows the app to
   * adjust the corresponding video stream type based on the size of the video
   * window to reduce the bandwidth and resources.
   *
   * The aspect ratio of the low-video stream is the same as the high-video
   * stream. Once the resolution of the high-video stream is set, the system
   * automatically sets the resolution, frame rate, and bitrate of the
   * low-video stream.
   * The SDK reports the result of calling this method in the
   * `apiCallExecuted` callback.
   * @param {number} uid ID of the remote user sending the video stream.
   * @param {StreamType} streamType Sets the video stream type:
   * - 0: High-stream video, the high-resolution, high-bitrate video.
   * - 1: Low-stream video, the low-resolution, low-bitrate video.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setRemoteVideoStreamType(uid: number, streamType: StreamType): number {
    return this.rtcEngine.setRemoteVideoStreamType(uid, streamType);
  }

  /**
   * Sets the default video-stream type of the remotely subscribed video stream
   * when the remote user sends dual streams.
   * @param {StreamType} streamType Sets the video stream type:
   * - 0: High-stream video, the high-resolution, high-bitrate video.
   * - 1: Low-stream video, the low-resolution, low-bitrate video.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setRemoteDefaultVideoStreamType(streamType: StreamType): number {
    return this.rtcEngine.setRemoteDefaultVideoStreamType(streamType);
  }

  /**
   * @deprecated This method is deprecated. As of v3.0.0, the Electron SDK
   * automatically enables interoperability with the Web SDK, so you no longer
   * need to call this method.
   *
   * Enables interoperability with the Agora Web SDK (live streaming only).
   *
   * Use this method when the channel profile is `1` (live streaming).
   * Interoperability with the Agora Web SDK is enabled by default when the
   * channel profile is Communication.
   *
   * If the channel has Web SDK users, ensure that you call this method, or
   * the video of the Native user will be a black screen for the Web user.
   * @param {boolean} enable Sets whether to enable/disable interoperability
   * with the Agora Web SDK:
   * - true: Enable.
   * - false: (Default) Disable.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableWebSdkInteroperability(enable: boolean): number {
    return this.rtcEngine.enableWebSdkInteroperability(enable);
  }

  /**
   * Sets the local video mirror mode.
   *
   * Use this method before {@link startPreview}, or it does not take effect
   * until you re-enable startPreview.
   *
   * @param {number} mirrortype Sets the local video mirror mode:
   * - 0: (Default) The SDK enables the mirror mode.
   * - 1: Enable the mirror mode
   * - 2: Disable the mirror mode
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setLocalVideoMirrorMode(mirrortype: 0 | 1 | 2): number {
    return this.rtcEngine.setLocalVideoMirrorMode(mirrortype);
  }

  /**
   * Changes the voice pitch of the local speaker.
   * @param {number} pitch - The value ranges between 0.5 and 2.0.
   * The lower the value, the lower the voice pitch.
   * The default value is 1.0 (no change to the local voice pitch).
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setLocalVoicePitch(pitch: number): number {
    return this.rtcEngine.setLocalVoicePitch(pitch);
  }

  /**
   * Sets the local voice equalization effect.
   *
   * @param {number} bandFrequency Sets the index of the band center frequency.
   * The value ranges between 0 and 9, representing the respective band
   * center frequencies of the voice effects
   * including 31, 62, 125, 500, 1k, 2k, 4k, 8k, and 16kHz.
   * @param {number} bandGain Sets the gain (dB) of each band. The value
   * ranges between -15 and 15. The default value is 0.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setLocalVoiceEqualization(bandFrequency: number, bandGain: number): number {
    return this.rtcEngine.setLocalVoiceEqualization(bandFrequency, bandGain);
  }

  /**
   * Sets the local voice reverberation.
   *
   * @param {number} reverbKey Sets the audio reverberation key.
   * - `0`: Level (dB) of the dry signal. The value ranges between -20 and 10.
   * - `1`: Level (dB) of the early reflection signal
   * (wet signal). The value ranges between -20 and 10.
   * - `2`: Room size of the reflection. A larger
   * room size means a stronger reverbration. The value ranges between 0 and
   * 100.
   * - `3`: Length (ms) of the initial delay of the wet
   * signal. The value ranges between 0 and 200.
   * - `4`: The reverberation strength. The value ranges between 0 and 100.
   *
   * @param {number} value Sets the effect of the reverberation key. See
   * `reverbKey` for the value range.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setLocalVoiceReverb(reverbKey: number, value: number): number {
    return this.rtcEngine.setLocalVoiceReverb(reverbKey, value);
  }

  /**
   * @deprecated This method is deprecated from v3.2.0
   * Use the {@link setAudioEffectPreset} or {@link setVoiceBeautifierPreset}
   * method instead.
   *
   * Sets the local voice changer option.
   * @param {VoiceChangerPreset} preset The local voice changer option.
   * See {@link VoiceChangerPreset}.
   */
  setLocalVoiceChanger(preset: VoiceChangerPreset): number {
    return this.rtcEngine.setLocalVoiceChanger(preset);
  }

  /**
   * @deprecated This method is deprecated from v3.2.0.
   * Use the {@link setAudioEffectPreset} or {@link setVoiceBeautifierPreset}
   * method instead.
   *
   * Sets the preset local voice reverberation effect.
   *
   * **Note**:
   * - Do not use this method together with {@link setLocalVoiceReverb}.
   * - Do not use this method together with {@link setLocalVoiceChanger},
   * or the method called eariler does not take effect.
   * @param {AudioReverbPreset} preset The local voice reverberation preset.
   * See {@link AudioReverbPreset}.
   */
  setLocalVoiceReverbPreset(preset: AudioReverbPreset) {
    return this.rtcEngine.setLocalVoiceReverbPreset(preset);
  }

  /**
   * Sets the fallback option for the locally published video stream based on
   * the network conditions.
   *
   * The default setting for option is `STREAM_FALLBACK_OPTION_AUDIO_ONLY (2)`,
   * where
   * there is no fallback for the locally published video stream when the
   * uplink network conditions are poor.
   * If `option` is set to `STREAM_FALLBACK_OPTION_AUDIO_ONLY (2)`, the SDK
   * will:
   * - Disable the upstream video but enable audio only when the network
   * conditions worsen and cannot support both video and audio.
   * - Re-enable the video when the network conditions improve.
   * When the locally published stream falls back to audio only or when the
   * audio stream switches back to the video,
   * the `localPublishFallbackToAudioOnly` callback is triggered.
   *
   * @note
   * Agora does not recommend using this method for CDN live streaming, because
   * the CDN audience will have a noticeable lag when the locally
   * publish stream falls back to audio-only.
   *
   * @param {number} option Sets the fallback option for the locally published
   * video stream.
   * - `STREAM_FALLBACK_OPTION_DISABLED (0)`: (Default) No fallback behavior
   * for the local/remote video stream when the uplink/downlink network
   * conditions are poor. The quality of the stream is not guaranteed.
   * - `STREAM_FALLBACK_OPTION_VIDEO_STREAM_LOW (1)`: (Default) The remote
   * video stream falls back to the low-stream video when the downlink network
   * condition worsens. This option works not for the
   * {@link setLocalPublishFallbackOption} method.
   * - `STREAM_FALLBACK_OPTION_AUDIO_ONLY (2)`: Under poor uplink network
   * conditions, the locally published video stream falls back to audio only.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setLocalPublishFallbackOption(option: 0 | 1 | 2): number {
    return this.rtcEngine.setLocalPublishFallbackOption(option);
  }

  /**
   * Sets the fallback option for the remote video stream based
   * on the network conditions.
   *
   * If `option` is set as `STREAM_FALLBACK_OPTION_VIDEO_STREAM_LOW (1)` or
   * `STREAM_FALLBACK_OPTION_AUDIO_ONLY (2)`:
   * - the SDK automatically switches the video from a high-stream to a
   * low-stream, or disables the video when the downlink network condition
   * cannot support both audio and video
   * to guarantee the quality of the audio.
   * - The SDK monitors the network quality and restores the video stream when
   * the network conditions improve.
   *
   * When the remote video stream falls back to audio only or when
   * the audio-only stream switches back to the video stream,
   * the SDK triggers the `remoteSubscribeFallbackToAudioOnly` callback.
   *
   * @param {number} option Sets the fallback option for the remote stream.
   * - `STREAM_FALLBACK_OPTION_DISABLED (0)`: No fallback behavior for the
   * local/remote video stream when the uplink/downlink network conditions
   * are poor. The quality of the stream is not guaranteed.
   * - `STREAM_FALLBACK_OPTION_VIDEO_STREAM_LOW (1)`: (Default) The remote
   * video stream falls back to the low-stream video when the downlink network
   * condition worsens. This option works only
   * for this method and not for the {@link setLocalPublishFallbackOption}
   * method.
   * - `STREAM_FALLBACK_OPTION_AUDIO_ONLY (2)`: Under poor downlink network
   * conditions, the remote video stream first falls back to the
   * low-stream video; and then to an audio-only stream if the network
   * condition worsens.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setRemoteSubscribeFallbackOption(option: 0 | 1 | 2): number {
    return this.rtcEngine.setRemoteSubscribeFallbackOption(option);
  }
  /**
   * Registers a user account.
   * Once registered, the user account can be used to identify the local user
   * when the user joins the channel. After the user successfully registers a
   * user account,  the SDK triggers the onLocalUserRegistered callback on the
   * local client,
   * reporting the user ID and user account of the local user.
   *
   * To join a channel with a user account, you can choose either of the
   * following:
   * - Call the {@link registerLocalUserAccount} method to create a user
   * account, and then the {@link joinChannelWithUserAccount} method to
   * join the channel.
   * - Call the {@link joinChannelWithUserAccount} method to join the
   * channel.
   *
   * The difference between the two is that for the former, the time elapsed
   * between calling the {@link joinChannelWithUserAccount} method and joining
   * the channel is shorter than the latter.
   *
   * To ensure smooth communication, use the same parameter type to identify
   * the user. For example, if a user joins the channel with a user ID, then
   * ensure all the other users use the user ID too. The same applies to the
   * user account. If a user joins the channel with the Agora Web SDK, ensure
   * that the `uid` of the user is set to the same parameter type.
   *
   * **Note**:
   * - Ensure that you set the `userAccount` parameter. Otherwise, this method
   * does not take effect.
   * - Ensure that the value of the `userAccount` parameter is unique in the
   * channel.
   *
   * @param {string} appId The App ID of your project.
   * @param {string} userAccount The user account. The maximum length of this
   * parameter is 255 bytes. Ensure that you set this parameter and do not
   * set it as null. Ensure that you set this parameter and do not set it as
   * null.
   * Supported character scopes are:
   * - All lowercase English letters: a to z.
   * - All uppercase English letters: A to Z.
   * - All numeric characters: 0 to 9.
   * - The space character.
   * - Punctuation characters and other symbols, including: "!", "#", "$",
   * "%", "&", "(", ")", "+", "-", ":", ";", "<", "=", ".",
   * ">", "?", "@", "[", "]", "^", "_", " {", "}", "|", "~", ",".
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  registerLocalUserAccount(appId: string, userAccount: string): number {
    return this.rtcEngine.registerLocalUserAccount(appId, userAccount);
  }
  /**
   * Joins the channel with a user account.
   *
   * After the user successfully joins the channel, the SDK triggers the
   * following callbacks:
   * - The local client: localUserRegistered and userInfoUpdated.
   * - The remote client: userJoined and userInfoUpdated, if the user joining
   * the channel is in the communication(`0`) profile, or is a host in the
   * `1` (live streaming) profile.
   *
   * **Note**: To ensure smooth communication, use the same parameter type to
   * identify the user. For example, if a user joins the channel with a user
   * ID, then ensure all the other users use the user ID too.
   * The same applies to the user account. If a user joins the channel with
   * the Agora Web SDK, ensure that the `uid` of the user is set to the same
   * parameter type.
   * @param {string} token The token generated at your server.
   * - For low-security requirements: You can use the temporary token generated
   * at Dashboard. For details, see
   * [Get a temporary token](https://docs.agora.io/en/Voice/token?platform=All%20Platforms#get-a-temporary-token).
   * - For high-security requirements: Set it as the token generated at your
   * server. For details, see
   * [Get a token](https://docs.agora.io/en/Voice/token?platform=All%20Platforms#get-a-token).
   * @param {string} channel The channel name. The maximum length of this
   * parameter is 64 bytes. Supported character scopes are:
   * - The 26 lowercase English letters: a to z.
   * - The 26 uppercase English letters: A to Z.
   * - The 10 numbers: 0 to 9.
   * - The space.
   * - "!", "#", "$", "%", "&", "(", ")", "+", "-", ":", ";", "<", "=", ".",
   * ">", "?", "@", "[", "]", "^", "_", " {", "}", "|", "~", ",".
   * @param {string} userAccount The user account. The maximum length of this
   * parameter is 255 bytes. Ensure that you set this parameter and do not set
   * it as null.
   * Supported character scopes are:
   * - The 26 lowercase English letters: a to z.
   * - The 26 uppercase English letters: A to Z.
   * - The 10 numbers: 0 to 9.
   * - The space.
   * - "!", "#", "$", "%", "&", "(", ")", "+", "-", ":", ";", "<", "=", ".",
   * ">", "?", "@", "[", "]", "^", "_", " {", "}", "|", "~", ",".
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *  - `ERR_INVALID_ARGUMENT (2)`
   *  - `ERR_NOT_READY (3)`
   *  - `ERR_REFUSED (5)`
   */
  joinChannelWithUserAccount(
    token: string,
    channel: string,
    userAccount: string
  ): number {
    return this.rtcEngine.joinChannelWithUserAccount(
      token,
      channel,
      userAccount
    );
  }
  /**
   * Gets the user information by passing in the user account.
   *
   * After a remote user joins the channel, the SDK gets the user ID and user
   * account of the remote user, caches them in a mapping table object
   * (UserInfo),
   * and triggers the `userInfoUpdated` callback on the local client.
   * After receiving the callback, you can call this method to get the user ID
   * of the remote user from the `UserInfo` object by passing in the user
   * account.
   * @param userAccount The user account. Ensure that you set this parameter.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  /**
   *
   * @param userAccount
   */
  getUserInfoByUserAccount(
    userAccount: string
  ): { errCode: number; userInfo: UserInfo } {
    return this.rtcEngine.getUserInfoByUserAccount(userAccount);
  }
  /**
   * Gets the user information by passing in the user ID.
   *
   * After a remote user joins the channel, the SDK gets the user ID and user
   * account of the remote user, caches them in a mapping table object
   * (UserInfo), and triggers the userInfoUpdated callback on the local client.
   * After receiving the callback, you can call this method to get the user
   * account of the remote user from the UserInfo object by passing in the
   * user ID.
   * @param uid The user ID. Ensure that you set this parameter.
   *
   * @return
   * - errCode Error code.
   * - userInfo [in/out] A UserInfo object that identifies the user:
   *  - Input: A UserInfo object.
   *  - Output: A UserInfo object that contains the user account and user ID
   * of the user.
   */
  getUserInfoByUid(uid: number): { errCode: number; userInfo: UserInfo } {
    return this.rtcEngine.getUserInfoByUid(uid);
  }
  /**
   * Switches to a different channel.
   *
   * This method allows the audience of a Live-broadcast channel to switch to
   * a different channel.
   *
   * After the user successfully switches to another channel, the leavechannel
   * and joinedChannel callbacks are triggered to indicate that the user has
   * left the original channel and joined a new one.
   *
   * @note
   * This method applies to the audience in a `1` (live streaming) profile only.
   *
   * @param token The token generated at your server:
   * - For low-security requirements: You can use the temporary token generated
   * at Console. For details,
   * see [Get a temporary token](https://docs.agora.io/en/Voice/token?platform=All%20Platforms#get-a-temporary-token).
   * - For high-security requirements: Set it as the token generated at your
   * server. For details,
   * see [Get a token](https://docs.agora.io/en/Voice/token?platform=All%20Platforms#get-a-token).
   * @param channel (Required) Pointer to the unique channel name for the
   * Agora RTC session in the string format smaller than 64 bytes.
   * Supported characters:
   * - The 26 lowercase English letters: a to z.
   * - The 26 uppercase English letters: A to Z.
   * - The 10 numbers: 0 to 9.
   * - The space.
   * - "!", "#", "$", "%", "&", "(", ")", "+", "-", ":", ";", "<", "=", ".",
   * ">", "?", "@", "[", "]", "^", "_", " {", "}", "|", "~", ",".
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *  - `ERR_INVALID_ARGUMENT (2)`
   *  - `ERR_NOT_READY (3)`
   *  - `ERR_REFUSED (5)`
   */
  switchChannel(token: string, channel: string) : number {
    return this.rtcEngine.switchChannel(token, channel);
  }

  /**
   * Adjusts the recording volume.
   * @param {number} volume Recording volume. To avoid echoes and improve call
   * quality, Agora recommends setting the value of volume between 0 and 100.
   * If you need to set the value higher than 100, contact support@agora.io
   * first.
   * - 0: Mute.
   * - 100: Original volume.
   * protection.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  adjustRecordingSignalVolume(volume: number): number {
    return this.rtcEngine.adjustRecordingSignalVolume(volume);
  }
  /**
   * Adjusts the playback volume of the voice.
   * @param volume Playback volume of the voice. To avoid echoes and improve
   * call quality, Agora recommends setting the value of volume between 0 and
   * 100. If you need to set the value higher than 100, contact
   * support@agora.io first.
   * - 0: Mute.
   * - 100: Original volume.
   * protection.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  adjustPlaybackSignalVolume(volume: number): number {
    return this.rtcEngine.adjustPlaybackSignalVolume(volume);
  }
  /**
   * Adjusts the playback volume of a specified remote user.
   *
   * You can call this method as many times as necessary to adjust the playback
   * volume of different remote users, or to repeatedly adjust the playback
   * volume of the same remote user.
   *
   * @note
   * - Call this method after joining a channel.
   * - The playback volume here refers to the mixed volume of a specified
   * remote user.
   * - This method can only adjust the playback volume of one specified remote
   * user at a time. To adjust the playback volume of different remote users,
   * call the method as many times, once for each remote user.
   *
   * @param uid The ID of the remote user.
   * @param volume The playback volume of the specified remote user. The value
   * ranges from 0 to 100:
   * - 0: Mute.
   * - 100: Original volume.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  adjustUserPlaybackSignalVolume(uid: number, volume: number): number {
    return this.rtcEngine.adjustUserPlaybackSignalVolume(uid, volume);
  }

  // ===========================================================================
  // DEVICE MANAGEMENT
  // ===========================================================================
  /**
   * Gets the list of the video devices.
   * @return {Array} The array of the video devices.
   */
  getVideoDevices(): Array<Object> {
    return this.rtcEngine.getVideoDevices();
  }

  /**
   * Sets the video device using the device Id.
   * @param {string} deviceId The device Id.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setVideoDevice(deviceId: string): number {
    return this.rtcEngine.setVideoDevice(deviceId);
  }

  /**
   * Gets the current video device.
   * @return {Object} The video device.
   */
  getCurrentVideoDevice(): Object {
    return this.rtcEngine.getCurrentVideoDevice();
  }

  /**
   * Starts a video-capture device test.
   *
   * **Note**:
   * This method tests whether the video-capture device works properly.
   * Ensure that you call the {@link enableVideo} method before calling this
   * method and that the HWND window handle of the incoming parameter is valid.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startVideoDeviceTest(): number {
    return this.rtcEngine.startVideoDeviceTest();
  }

  /**
   * Stops the video-capture device test.
   *
   * **Note**:
   * This method stops testing the video-capture device.
   * You must call this method to stop the test after calling the
   * {@link startVideoDeviceTest} method.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopVideoDeviceTest(): number {
    return this.rtcEngine.stopVideoDeviceTest();
  }

  /**
   * Retrieves the audio playback device associated with the device ID.
   * @return {Array} The array of the audio playback device.
   */
  getAudioPlaybackDevices(): Array<Object> {
    return this.rtcEngine.getAudioPlaybackDevices();
  }

  /**
   * Sets the audio playback device using the device ID.
   * @param {string} deviceId The device ID of the audio playback device.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioPlaybackDevice(deviceId: string): number {
    return this.rtcEngine.setAudioPlaybackDevice(deviceId);
  }

  /**
   * Retrieves the audio playback device information associated with the
   * device ID and device name.
   * @param {string} deviceId The device ID of the audio playback device.
   * @param {string} deviceName The device name of the audio playback device.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */

  getPlaybackDeviceInfo(deviceId: string, deviceName: string): number {
    return this.rtcEngine.getPlaybackDeviceInfo(deviceId, deviceName);
  }

  /**
   * Gets the current audio playback device.
   * @return {Object} The current audio playback device.
   */
  getCurrentAudioPlaybackDevice(): Object {
    return this.rtcEngine.getCurrentAudioPlaybackDevice();
  }

  /**
   * Sets the volume of the audio playback device.
   * @param {number} volume Sets the volume of the audio playback device. The
   * value ranges between 0 (lowest volume) and 255 (highest volume).
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioPlaybackVolume(volume: number): number {
    return this.rtcEngine.setAudioPlaybackVolume(volume);
  }

  /**
   * Retrieves the volume of the audio playback device.
   * @return The audio playback device volume.
   */
  getAudioPlaybackVolume(): number {
    return this.rtcEngine.getAudioPlaybackVolume();
  }

  /**
   * Retrieves the audio recording device associated with the device ID.
   * @return {Array} The array of the audio recording device.
   */
  getAudioRecordingDevices(): Array<Object> {
    return this.rtcEngine.getAudioRecordingDevices();
  }

  /**
   * Sets the audio recording device using the device ID.
   * @param {string} deviceId The device ID of the audio recording device.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioRecordingDevice(deviceId: string): number {
    return this.rtcEngine.setAudioRecordingDevice(deviceId);
  }

  /**
   * Retrieves the audio recording device information associated with the
   * device ID and device name.
   * @param {string} deviceId The device ID of the recording audio device.
   * @param {string} deviceName  The device name of the recording audio device.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  getRecordingDeviceInfo(deviceId: string, deviceName: string): number {
    return this.rtcEngine.getRecordingDeviceInfo(deviceId, deviceName);
  }

  /**
   * Gets the current audio recording device.
   * @return {Object} The audio recording device.
   */
  getCurrentAudioRecordingDevice(): Object {
    return this.rtcEngine.getCurrentAudioRecordingDevice();
  }

  /**
   * Retrieves the volume of the microphone.
   * @return {number} The microphone volume. The volume value ranges between
   * 0 (lowest volume) and 255 (highest volume).
   */
  getAudioRecordingVolume(): number {
    return this.rtcEngine.getAudioRecordingVolume();
  }

  /**
   * Sets the volume of the microphone.
   * @param {number} volume Sets the volume of the microphone. The value
   * ranges between 0 (lowest volume) and 255 (highest volume).
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioRecordingVolume(volume: number): number {
    return this.rtcEngine.setAudioRecordingVolume(volume);
  }

  /**
   * Starts the audio playback device test.
   *
   * This method tests if the playback device works properly. In the test,
   * the SDK plays an audio file specified by the user.
   * If the user can hear the audio, the playback device works properly.
   * @param {string} filepath The path of the audio file for the audio playback
   * device test in UTF-8:
   * - Supported file formats: wav, mp3, m4a, and aac.
   * - Supported file sample rates: 8000, 16000, 32000, 44100, and 48000 Hz.
   * @return
   * - 0: Success, and you can hear the sound of the specified audio file.
   * - < 0: Failure.
   */
  startAudioPlaybackDeviceTest(filepath: string): number {
    return this.rtcEngine.startAudioPlaybackDeviceTest(filepath);
  }

  /**
   * Stops the audio playback device test.
   *
   * This method stops testing the audio playback device.
   * You must call this method to stop the test after calling the
   * {@link startAudioPlaybackDeviceTest} method.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopAudioPlaybackDeviceTest(): number {
    return this.rtcEngine.stopAudioPlaybackDeviceTest();
  }

  /**
   * Starts the audio device loopback test.
   *
   * This method tests whether the local audio devices are working properly.
   * After calling this method, the microphone captures the local audio and
   * plays it through the speaker.
   *
   * **Note**:
   * This method tests the local audio devices and does not report the network
   * conditions.
   * @param {number} interval The time interval (ms).
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startAudioDeviceLoopbackTest(interval: number): number {
    return this.rtcEngine.startAudioDeviceLoopbackTest(interval);
  }

  /**
   * Stops the audio device loopback test.
   *
   * **Note**:
   * Ensure that you call this method to stop the loopback test after calling
   * the {@link startAudioDeviceLoopbackTest} method.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopAudioDeviceLoopbackTest(): number {
    return this.rtcEngine.stopAudioDeviceLoopbackTest();
  }

  /** Enables loopback audio capturing.
   *
   * If you enable loopback audio capturing, the output of the sound card is
   * mixed into the audio stream sent to the other end.
   *
   * @note You can call this method either before or after joining a channel.
   *
   * @param enable Sets whether to enable/disable loopback capturing.
   * - true: Enable loopback capturing.
   * - false: (Default) Disable loopback capturing.
   * @param deviceName The device name of the sound card. The default value
   * is NULL (the default sound card). **Note**: macOS does not support
   * loopback capturing of the default sound card.
   * If you need to use this method, please use a virtual sound card and pass
   * its name to the deviceName parameter. Agora has tested and recommends
   * using soundflower.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  enableLoopbackRecording(
    enable = false,
    deviceName: string | null = null
  ): number {
    return this.rtcEngine.enableLoopbackRecording(enable, deviceName);
  }
  /**
   * @since v3.0.0
   *
   * Starts an audio recording on the client.
   *
   * The SDK allows recording during a call. After successfully calling this
   * method, you can record the audio of all the users in the channel and get
   * an audio recording file.
   * Supported formats of the recording file are as follows:
   * - .wav: Large file size with high fidelity.
   * - .aac: Small file size with low fidelity.
   *
   * @note
   * - Ensure that the directory you use to save the recording file exists and
   * is writable.
   * - This method is usually called after {@link joinChannel}. The
   * recording automatically stops when you call {@link leaveChannel}.
   * - For better recording effects, set quality as MEDIUM or HIGH when
   * `sampleRate` is 44.1 kHz or 48 kHz.
   *
   * @param filePath The absolute file path of the recording file. The string
   * of the file name is in UTF-8, such as `c:/music/audio.aac` for Windows and
   * `file:///Users/Agora/Music/audio.aac` for macOS.
   * @param sampleRate Sample rate (Hz) of the recording file. Supported
   * values are as follows:
   * - 16000
   * - (Default) 32000
   * - 44100
   * - 48000
   * @param quality The audio recording quality:
   * - `0`: Low quality. The sample rate is 32 kHz, and the file size is around
   * 1.2 MB after 10 minutes of recording.
   * - `1`: Medium quality. The sample rate is 32 kHz, and the file size is
   * around 2 MB after 10 minutes of recording.
   * - `2`: High quality. The sample rate is 32 kHz, and the file size is
   * around 3.75 MB after 10 minutes of recording.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  startAudioRecording(filePath: string, sampleRate:number, quality: number):number {
    return this.rtcEngine.startAudioRecording(filePath, sampleRate, quality)
  }
  /**
   * Stops an audio recording on the client.
   *
   * You can call this method before calling the {@link leaveChannel} method
   * else to stop the recording automatically.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  stopAudioRecording():number {
    return this.rtcEngine.stopAudioRecording()
  }

  /**
   * Starts the microphone test.
   *
   * This method checks whether the microphone works properly.
   * @param {number} indicateInterval The interval period (ms).
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startAudioRecordingDeviceTest(indicateInterval: number): number {
    return this.rtcEngine.startAudioRecordingDeviceTest(indicateInterval);
  }

  /**
   * Stops the microphone test.
   *
   * **Note**:
   * This method stops the microphone test.
   * You must call this method to stop the test after calling the
   * {@link startAudioRecordingDeviceTest} method.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopAudioRecordingDeviceTest(): number {
    return this.rtcEngine.stopAudioRecordingDeviceTest();
  }

  /**
   * check whether selected audio playback device is muted
   * @return {boolean} muted/unmuted
   */
  getAudioPlaybackDeviceMute(): boolean {
    return this.rtcEngine.getAudioPlaybackDeviceMute();
  }

  /**
   * Mutes the audio playback device.
   * @param {boolean} mute Sets whether to mute/unmute the audio playback
   * device:
   * - true: Mutes.
   * - false: Unmutes.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioPlaybackDeviceMute(mute: boolean): number {
    return this.rtcEngine.setAudioPlaybackDeviceMute(mute);
  }

  /**
   * Retrieves the mute status of the audio playback device.
   * @return {boolean} Whether to mute/unmute the audio playback device:
   * - true: Mutes.
   * - false: Unmutes.
   */
  getAudioRecordingDeviceMute(): boolean {
    return this.rtcEngine.getAudioRecordingDeviceMute();
  }

  /**
   * Mutes/Unmutes the microphone.
   * @param {boolean} mute Sets whether to mute/unmute the audio playback
   * device:
   * - true: Mutes.
   * - false: Unmutes.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioRecordingDeviceMute(mute: boolean): number {
    return this.rtcEngine.setAudioRecordingDeviceMute(mute);
  }

  // ===========================================================================
  // VIDEO SOURCE
  // NOTE. video source is mainly used to do screenshare, the api basically
  // aligns with normal sdk apis, e.g. videoSourceInitialize vs initialize.
  // it is used to do screenshare with a separate process, in that case
  // it allows user to do screensharing and camera stream pushing at the
  // same time - which is not allowed in single sdk process.
  // if you only need to display camera and screensharing one at a time
  // use sdk original screenshare, if you want both, use video source.
  // ===========================================================================
  /**
   * Initializes agora real-time-communicating video source with the app Id.
   * @param {string} appId The app ID issued to you by Agora.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *  - `ERR_INVALID_APP_ID (101)`: The app ID is invalid. Check if it is in
   * the correct format.
   */
  videoSourceInitialize(appId: string): number {
    return this.rtcEngine.videoSourceInitialize(appId);
  }

  /**
   * Sets the video renderer for video source.
   * @param {Element} view The dom element where video source should be
   * displayed.
   */
  setupLocalVideoSource(view: Element): void {
    this.initRender('videosource', view, "");
  }

  /**
   * @deprecated This method is deprecated. As of v3.0.0, the Electron SDK
   * automatically enables interoperability with the Web SDK, so you no longer
   * need to call this method.
   *
   * Enables the web interoperability of the video source, if you set it to
   * true.
   *
   * **Note**:
   * You must call this method after calling the {@link videoSourceInitialize}
   * method.
   *
   * @param {boolean} enabled Set whether or not to enable the web
   * interoperability of the video source.
   * - true: Enables the web interoperability.
   * - false: Disables web interoperability.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceEnableWebSdkInteroperability(enabled: boolean): number {
    return this.rtcEngine.videoSourceEnableWebSdkInteroperability(enabled);
  }

  /**
   * Allows a user to join a channel when using the video source.
   *
   * @param {string} token The token generated at your server:
   * - For low-security requirements: You can use the temporary token
   * generated at Console. For details, see
   * [Get a temporary token](https://docs.agora.io/en/Voice/token?platform=All%20Platforms#get-a-temporary-token).
   * - For high-security requirements: Set it as the token generated at your
   * server. For details, see
   * [Get a token](https://docs.agora.io/en/Voice/token?platform=All%20Platforms#get-a-token).
   * @param {string} cname (Required) Pointer to the unique channel name for
   * the Agora RTC session in the string format smaller than 64 bytes.
   * Supported characters:
   * - The 26 lowercase English letters: a to z.
   * - The 26 uppercase English letters: A to Z.
   * - The 10 numbers: 0 to 9.
   * - The space.
   * - "!", "#", "$", "%", "&", "(", ")", "+", "-", ":", ";", "<", "=", ".",
   * ">", "?", "@", "[", "]", "^", "_", " {", "}", "|", "~", ",".
   * @param {string} info Pointer to additional information about the channel.
   * This parameter can be set to NULL or contain channel related information.
   * Other users in the channel will not receive this message.
   * @param {number} uid The User ID. The same user ID cannot appear in a
   * channel. Ensure that the user ID of the `videoSource` here is different
   * from the `uid` used by the user when calling the {@link joinChannel}
   * method.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceJoin(
    token: string,
    cname: string,
    info: string,
    uid: number
  ): number {
    return this.rtcEngine.videoSourceJoin(token, cname, info, uid);
  }

  /**
   * Allows a user to leave a channe when using the video source.
   *
   * **Note**:
   * You must call this method after calling the {@link videoSourceJoin} method.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceLeave(): number {
    return this.rtcEngine.videoSourceLeave();
  }

  /**
   * Gets a new token for a user using the video source when the current token
   * expires after a period of time.
   *
   * The application should call this method to get the new `token`.
   * Failure to do so will result in the SDK disconnecting from the server.
   *
   * @param {string} token The new token.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceRenewToken(token: string): number {
    return this.rtcEngine.videoSourceRenewToken(token);
  }

  /**
   * Sets the channel profile when using the video source.
   *
   * @param {number} profile Sets the channel profile:
   * - 0:(Default) Communication.
   * - 1: Live streaming.
   * - 2: Gaming.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceSetChannelProfile(profile: number): number {
    return this.rtcEngine.videoSourceSetChannelProfile(profile);
  }

  /**
   * Sets the video profile when using the video source.
   * @param {VIDEO_PROFILE_TYPE} profile The video profile. See
   * {@link VIDEO_PROFILE_TYPE}.
   * @param {boolean} [swapWidthAndHeight = false] Whether to swap width and
   * height:
   * - true: Swap the width and height.
   * - false: Do not swap the width and height.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceSetVideoProfile(
    profile: VIDEO_PROFILE_TYPE,
    swapWidthAndHeight = false
  ): number {
    return this.rtcEngine.videoSourceSetVideoProfile(
      profile,
      swapWidthAndHeight
    );
  }

  /**
   * Gets the window ID when using the video source.
   *
   * This method gets the ID of the whole window and relevant inforamtion.
   * You can share the whole or part of a window by specifying the window ID.
   * @return {Array} The array list of the window ID and relevant information.
   */
  getScreenWindowsInfo(): Array<Object> {
    return this.rtcEngine.getScreenWindowsInfo();
  }

  /**
   * Gets the display ID when using the video source.
   *
   * This method gets the ID of the whole display and relevant inforamtion.
   * You can share the whole or part of a display by specifying the window ID.
   * @return {Array} The array list of the display ID and relevant information.
   * The display ID returned is different on Windows and macOS systems.
   * You don't need to pay attention to the specific content of the returned
   * object, just use it for screen sharing.
   */
  getScreenDisplaysInfo(): Array<Object> {
    return this.rtcEngine.getScreenDisplaysInfo();
  }

  /**
   * @deprecated This method is deprecated. Use
   * {@link videoSourceStartScreenCaptureByScreen} or
   * {@link videoSourceStartScreenCaptureByWindow} instead.
   *
   * Starts the video source.
   * @param {number} wndid Sets the video source area.
   * @param {number} captureFreq (Mandatory) The captured frame rate. The value
   * ranges between 1 fps and 15 fps.
   * @param {*} rect Specifies the video source region. `rect` is valid when
   * `wndid` is set as 0. When `rect` is set as NULL, the whole screen is
   * shared.
   * @param {number} bitrate The captured bitrate.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startScreenCapture2(
    windowId: number,
    captureFreq: number,
    rect: { left: number; right: number; top: number; bottom: number },
    bitrate: number
  ): number {
    deprecate(
      '"videoSourceStartScreenCaptureByScreen" or "videoSourceStartScreenCaptureByWindow"'
    );
    return this.rtcEngine.startScreenCapture2(
      windowId,
      captureFreq,
      rect,
      bitrate
    );
  }

  /**
   * Stops the screen sharing when using the video source.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopScreenCapture2(): number {
    return this.rtcEngine.stopScreenCapture2();
  }

  /**
   * Starts the local video preview when using the video source.
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  startScreenCapturePreview(): number {
    return this.rtcEngine.videoSourceStartPreview();
  }
  /**
   * Shares the whole or part of a window by specifying the window symbol.
   *
   * @param windowSymbol The symbol of the windows to be shared.
   * @param rect (Optional) The relative location of the region to the window.
   * NULL/NIL means sharing the whole window. See {@link CaptureRect}. If the
   * specified region overruns the window, the SDK shares only the region
   * within it; if you set width or height as 0, the SDK shares the whole
   * window.
   * @param param Window sharing encoding parameters. See {@link CaptureParam}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  startScreenCaptureByWindow(windowSymbol: number, rect: CaptureRect, param: CaptureParam): number {
    return this.rtcEngine.startScreenCaptureByWindow(windowSymbol, rect, param)
  }
  /**
   * Shares the whole or part of a screen by specifying the screen symbol.
   * @param screenSymbol The screen symbol. See {@link screenSymbol}
   * @param rect (Optional) The relative location of the region to the screen.
   * NULL means sharing the whole screen. See {@link CaptureRect}. If the
   * specified region overruns the screen, the SDK shares only the region
   * within it; if you set width or height as 0, the SDK shares the whole
   * screen.
   * @param param The screen sharing encoding parameters. See
   * {@link CaptureParam}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  startScreenCaptureByScreen(screenSymbol: ScreenSymbol, rect: CaptureRect, param: CaptureParam): number {
    return this.rtcEngine.startScreenCaptureByScreen(screenSymbol, rect, param)
  }
  /**
   * Updates the screen sharing parameters.
   *
   * @param param The screen sharing encoding parameters.
   * See {@link CaptureParam}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  updateScreenCaptureParameters(param: CaptureParam): number {
    return this.rtcEngine.updateScreenCaptureParameters(param)
  }
  /**
   * Sets the content hint for screen sharing.
   *
   * A content hint suggests the type of the content being shared, so that the
   * SDK applies different optimization algorithm to different types of
   * content.
   * @param hint The content hint for screen sharing.
   * See {@link VideoContentHint}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setScreenCaptureContentHint(hint: VideoContentHint): number {
    return this.rtcEngine.setScreenCaptureContentHint(hint)
  }

  /**
   * Stops the local video preview when using the video source.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopScreenCapturePreview(): number {
    return this.rtcEngine.videoSourceStopPreview();
  }

  /**
   * Enables the dual-stream mode for the video source.
   * @param {boolean} enable Whether or not to enable the dual-stream mode:
   * - true: Enables the dual-stream mode.
   * - false: Disables the dual-stream mode.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceEnableDualStreamMode(enable: boolean): number {
    return this.rtcEngine.videoSourceEnableDualStreamMode(enable);
  }

  /**
   * Sets the video source parameters.
   * @param {string} parameter Sets the video source encoding parameters.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceSetParameters(parameter: string): number {
    return this.rtcEngine.videoSourceSetParameter(parameter);
  }

  /**
   * Updates the screen capture region for the video source.
   * @param {*} rect {left: 0, right: 100, top: 0, bottom: 100} (relative
   * distance from the left-top corner of the screen)
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceUpdateScreenCaptureRegion(rect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }) {
    return this.rtcEngine.videoSourceUpdateScreenCaptureRegion(rect);
  }
  /** Enables loopback audio capturing.
   *
   * If you enable loopback audio capturing, the output of the sound card is
   * mixed into the audio stream sent to the other end.
   *
   * @note You can call this method either before or after joining a channel.
   *
   * @param enable Sets whether to enable/disable loopback capturing.
   * - true: Enable loopback capturing.
   * - false: (Default) Disable loopback capturing.
   * @param deviceName The device name of the sound card. The default value
   * is NULL (the default sound card). **Note**: macOS does not support
   * loopback capturing of the default sound card.
   * If you need to use this method, please use a virtual sound card and pass
   * its name to the deviceName parameter. Agora has tested and recommends
   * using soundflower.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  videoSourceEnableLoopbackRecording(enabled: boolean, deviceName: string | null = null) : number {
    return this.rtcEngine.videoSourceEnableLoopbackRecording(enabled, deviceName)
  }
  /**
   * Enables the audio module.
   *
   * The audio module is enabled by default.
   *
   * **Note**:
   * - This method affects the internal engine and can be called after calling
   * the {@link leaveChannel} method. You can call this method either before
   * or after joining a channel.
   * - This method resets the internal engine and takes some time to take
   * effect. We recommend using the following API methods to control the
   * audio engine modules separately:
   *   - {@link enableLocalAudio}: Whether to enable the microphone to create
   * the local audio stream.
   *   - {@link muteLocalAudioStream}: Whether to publish the local audio
   * stream.
   *   - {@link muteRemoteAudioStream}: Whether to subscribe to and play the
   * remote audio stream.
   *   - {@link muteAllRemoteAudioStreams}: Whether to subscribe to and play
   * all remote audio streams.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceEnableAudio() : number {
    return this.rtcEngine.videoSourceEnableAudio()
  }
  /** Enables/Disables the built-in encryption.
   *
   * @since v3.2.0
   *
   * In scenarios requiring high security, Agora recommends calling this
   * method to enable the built-in encryption before joining a channel.
   *
   * All users in the same channel must use the same encryption mode and
   * encryption key. Once all users leave the channel, the encryption key of
   * this channel is automatically cleared.
   *
   * **Note**:
   * - If you enable the built-in encryption, you cannot use the RTMP or
   * RTMPS streaming function.
   * - The SDK returns `-4` when the encryption mode is incorrect or
   * the SDK fails to load the external encryption library.
   * Check the enumeration or reload the external encryption library.
   *
   * @param enabled Whether to enable the built-in encryption:
   * - true: Enable the built-in encryption.
   * - false: Disable the built-in encryption.
   * @param encryptionConfig Configurations of built-in encryption schemas.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceEnableEncryption(enabled: boolean, encryptionConfig: EncryptionConfig): number {
    return this.rtcEngine.videoSourceEnableEncryption(enabled, encryptionConfig);
  }

  /**
   * @deprecated This method is deprecated from v3.2.0. Use the
   * {@link videoSourceEnableEncryption} method instead.
   *
   * Sets the built-in encryption mode.
   *
   * @param encryptionMode Pointer to the set encryption mode:
   * - `"aes-128-xts"`: (Default) 128-bit AES encryption, XTS mode.
   * - `"aes-128-ecb"`: 128-bit AES encryption, ECB mode.
   * - `"aes-256-xts"`: 256-bit AES encryption, XTS mode.
   * - `""`: The encryption mode is set as `"aes-128-xts"` by default.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceSetEncryptionMode(mode: string): number {
    return this.rtcEngine.videoSourceSetEncryptionMode(mode);
  }
  /** Enables built-in encryption with an encryption password before users
   * join a channel.
   *
   * @deprecated This method is deprecated from v3.2.0. Use the
   * {@link videoSourceEnableEncryption} method instead.
   *
   * @param secret Pointer to the encryption password.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceSetEncryptionSecret(secret: string): number {
    return this.rtcEngine.videoSourceSetEncryptionSecret(secret);
  }

  /**
   * Releases the video source object.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceRelease(): number {
    return this.rtcEngine.videoSourceRelease();
  }

  // 2.4 new Apis
  /**
   * Shares the whole or part of a screen by specifying the screen rect.
   * @param {ScreenSymbol} screenSymbol The display ID：
   * - macOS: The display ID.
   * - Windows: The screen rect.
   * @param {CaptureRect} rect Sets the relative location of the region
   * to the screen.
   * @param {CaptureParam} param Sets the video source encoding parameters.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */

  videoSourceStartScreenCaptureByScreen(
    screenSymbol: ScreenSymbol,
    rect: CaptureRect,
    param: CaptureParam
  ): number {
    return this.rtcEngine.videosourceStartScreenCaptureByScreen(
      screenSymbol,
      rect,
      param
    );
  }

  /**
   * Shares the whole or part of a window by specifying the window ID.
   * @param {number} windowSymbol The ID of the window to be shared.
   * @param {CaptureRect} rect The ID of the window to be shared.
   * @param {CaptureParam} param Sets the video source encoding parameters.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceStartScreenCaptureByWindow(
    windowSymbol: number,
    rect: CaptureRect,
    param: CaptureParam
  ): number {
    return this.rtcEngine.videosourceStartScreenCaptureByWindow(
      windowSymbol,
      rect,
      param
    );
  }

  /**
   * Updates the video source parameters.
   * @param {CaptureParam} param Sets the video source encoding parameters.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceUpdateScreenCaptureParameters(param: CaptureParam): number {
    return this.rtcEngine.videosourceUpdateScreenCaptureParameters(param);
  }

  /**
   *  Updates the video source parameters.
   * @param {VideoContentHint} hint Sets the content hint for the video source.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  videoSourceSetScreenCaptureContentHint(hint: VideoContentHint): number {
    return this.rtcEngine.videosourceSetScreenCaptureContentHint(hint);
  }

  // ===========================================================================
  // SCREEN SHARE
  // When this api is called, your camera stream will be replaced with
  // screenshare view. i.e. you can only see camera video or screenshare
  // one at a time via this section's api
  // ===========================================================================
  /**
   * Starts the screen sharing.
   *
   * @deprecated This method is deprecated. Use
   * {@link startScreenCaptureByWindow} instead.
   *
   * @param {number} wndid Sets the screen sharing area.
   * @param {number} captureFreq (Mandatory) The captured frame rate. The
   * value ranges between 1 fps and 15 fps.
   * @param {*} rect Specifies the screen sharing region. `rect` is valid
   * when `wndid` is set as 0. When `rect` is set as NULL, the whole screen
   * is shared.
   * @param {number} bitrate The captured bitrate.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startScreenCapture(
    windowId: number,
    captureFreq: number,
    rect: { left: number; right: number; top: number; bottom: number },
    bitrate: number
  ): number {
    deprecate();
    return this.rtcEngine.startScreenCapture(
      windowId,
      captureFreq,
      rect,
      bitrate
    );
  }

  /**
   * Stops screen sharing.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopScreenCapture(): number {
    return this.rtcEngine.stopScreenCapture();
  }

  /**
   * Updates the screen capture region.
   * @param {*} rect {left: 0, right: 100, top: 0, bottom: 100} (relative
   * distance from the left-top corner of the screen)
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  updateScreenCaptureRegion(rect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }): number {
    return this.rtcEngine.updateScreenCaptureRegion(rect);
  }

  // ===========================================================================
  // AUDIO MIXING
  // ===========================================================================
  /**
   * Starts playing and mixing the music file.
   *
   * This method mixes the specified local audio file with the audio stream
   * from the microphone, or replaces the microphone’s audio stream with the
   * specified
   * local audio file. You can choose whether the other user can hear the
   * local audio playback
   * and specify the number of loop playbacks. This API also supports online
   * music playback.
   *
   * The SDK returns the state of the audio mixing file playback in the
   * audioMixingStateChanged callback.
   *
   * **Note**:
   * - Call this method when you are in the channel, otherwise it may cause
   * issues.
   * - If the local audio mixing file does not exist, or if the SDK does not
   * support the file format
   * or cannot access the music file URL, the SDK returns the warning code 701.
   *
   * @param {string} filepath Specifies the absolute path (including the
   * suffixes of the filename) of the local or online audio file to be mixed.
   * Supported audio formats: mp3, mp4, m4a, aac, 3gp, mkv and wav.
   * @param {boolean} loopback Sets which user can hear the audio mixing:
   * - true: Only the local user can hear the audio mixing.
   * - false: Both users can hear the audio mixing.
   * @param {boolean} replace Sets the audio mixing content:
   * - true: Only publish the specified audio file; the audio stream from the
   * microphone is not published.
   * - false: The local audio file is mixed with the audio stream from the
   * microphone.
   * @param {number} cycle Sets the number of playback loops:
   * - Positive integer: Number of playback loops.
   * - -1: Infinite playback loops.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startAudioMixing(
    filepath: string,
    loopback: boolean,
    replace: boolean,
    cycle: number
  ): number {
    return this.rtcEngine.startAudioMixing(filepath, loopback, replace, cycle);
  }

  /**
   * Stops playing or mixing the music file.
   *
   * Call this API when you are in a channel.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopAudioMixing(): number {
    return this.rtcEngine.stopAudioMixing();
  }

  /**
   * Pauses playing and mixing the music file.
   *
   *  Call this API when you are in a channel.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  pauseAudioMixing(): number {
    return this.rtcEngine.pauseAudioMixing();
  }

  /**
   * Resumes playing and mixing the music file.
   *
   *  Call this API when you are in a channel.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  resumeAudioMixing(): number {
    return this.rtcEngine.resumeAudioMixing();
  }

  /**
   * Adjusts the volume of audio mixing.
   *
   * Call this API when you are in a channel.
   *
   * **Note**: Calling this method does not affect the volume of audio effect
   * file playback invoked by the playEffect method.
   * @param {number} volume Audio mixing volume. The value ranges between 0
   * and 100 (default). 100 is the original volume.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  adjustAudioMixingVolume(volume: number): number {
    return this.rtcEngine.adjustAudioMixingVolume(volume);
  }

  /**
   * Adjusts the audio mixing volume for local playback.
   * @param {number} volume Audio mixing volume for local playback. The value
   * ranges between 0 and 100 (default). 100 is the original volume.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  adjustAudioMixingPlayoutVolume(volume: number): number {
    return this.rtcEngine.adjustAudioMixingPlayoutVolume(volume);
  }

  /**
   * Adjusts the audio mixing volume for publishing (sending to other users).
   * @param {number} volume Audio mixing volume for publishing. The value
   * ranges between 0 and 100 (default). 100 is the original volume.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  adjustAudioMixingPublishVolume(volume: number): number {
    return this.rtcEngine.adjustAudioMixingPublishVolume(volume);
  }

  /**
   * Gets the duration (ms) of the music file.
   *
   * Call this API when you are in a channel.
   * @return
   * - ≥ 0: The audio mixing duration, if this method call succeeds.
   * - < 0: Failure.
   */
  getAudioMixingDuration(): number {
    return this.rtcEngine.getAudioMixingDuration();
  }

  /**
   * Gets the playback position (ms) of the music file.
   *
   * Call this API when you are in a channel.
   * @return
   * - ≥ 0: The current playback position of the audio mixing, if this method
   * call succeeds.
   * - < 0: Failure.
   */
  getAudioMixingCurrentPosition(): number {
    return this.rtcEngine.getAudioMixingCurrentPosition();
  }

  /**
   * Adjusts the audio mixing volume for publishing (for remote users).
   *
   * Call this API when you are in a channel.
   *
   * @return
   * - ≥ 0: The audio mixing volume for local playout, if this method call
   * succeeds. The value range is [0,100].
   * - < 0: Failure.
   */
  getAudioMixingPlayoutVolume(): number {
    return this.rtcEngine.getAudioMixingPlayoutVolume();
  }

  /**
   * Retrieves the audio mixing volume for publishing.
   *
   * Call this API when you are in a channel.
   *
   * @return
   * - ≥ 0: The audio mixing volume for publishing, if this method call
   * succeeds. The value range is [0,100].
   * - < 0: Failure.
   */
  getAudioMixingPublishVolume(): number {
    return this.rtcEngine.getAudioMixingPublishVolume();
  }

  /**
   * Sets the playback position of the music file to a different starting
   * position.
   *
   * This method drags the playback progress bar of the audio mixing file to
   * where
   * you want to play instead of playing it from the beginning.
   * @param {number} position The playback starting position (ms) of the music
   * file.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioMixingPosition(position: number): number {
    return this.rtcEngine.setAudioMixingPosition(position);
  }

  /** Sets the pitch of the local music file.
   *
   * @since v3.2.0
   *
   * When a local music file is mixed with a local human voice, call this
   * method to set the pitch of the local music file only.
   *
   * @note Call this method after calling {@link startAudioMixing}.
   *
   * @param pitch Sets the pitch of the local music file by chromatic scale.
   * The default value is 0,
   * which means keeping the original pitch. The value ranges from -12 to 12,
   * and the pitch value between
   * consecutive values is a chromatic value. The greater the absolute value
   * of this parameter, the
   * higher or lower the pitch of the local music file.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioMixingPitch(pitch: number): number {
    return this.rtcEngine.setAudioMixingPitch(pitch);
  }

  // ===========================================================================
  // CDN STREAMING
  // ===========================================================================
   /**
    * Publishes the local stream to a specified CDN live RTMP address.
    *
    * The SDK returns the result of this method call in the streamPublished
    * callback.
    *
    * @note
    * - Only the host in the `1` (live streaming) profile can call this
    * method.
    * - Call this method after the host joins the channel.
    * - Ensure that you enable the RTMP Converter service before using this
    * function. See *Prerequisites* in the *Push Streams to CDN* guide.
    * - This method adds only one stream URL address each time it is
    * called.
    *
    * @param {string} url The CDN streaming URL in the RTMP format. The
    * maximum length of this parameter is 1024 bytes. The RTMP URL address must
    * not contain special characters, such as Chinese language characters.
    * @param {bool} transcodingEnabled Sets whether transcoding is
    * enabled/disabled:
    * - true: Enable transcoding. To transcode the audio or video streams when
    * publishing them to CDN live,
    * often used for combining the audio and video streams of multiple hosts
    * in CDN live. If set the parameter as `true`, you should call the
    * {@link setLiveTranscoding} method before this method.
    * - false: Disable transcoding.
    * @return
    * - 0: Success.
    * - < 0: Failure.
    */
  addPublishStreamUrl(url: string, transcodingEnabled: boolean): number {
    return this.rtcEngine.addPublishStreamUrl(url, transcodingEnabled);
  }

  /**
   * Removes an RTMP stream from the CDN.
   * @note
   * - Only the host in the `1` (live streaming) profile can call this
   * method.
   * - This method removes only one RTMP URL address each time it is called.
   * - The RTMP URL address must not contain special characters, such as
   * Chinese language characters.
   * @param {string} url The RTMP URL address to be removed. The maximum
   * length of this parameter is 1024 bytes.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  removePublishStreamUrl(url: string): number {
    return this.rtcEngine.removePublishStreamUrl(url);
  }

  /**
   * Sets the video layout and audio settings for CDN live. (CDN live only)
   *
   * The SDK triggers the otranscodingUpdated callback when you call the
   * {@link setLiveTranscoding} method to update the LiveTranscoding class.
   *
   * @note
   * - Only the host in the Live-broadcast porfile can call this method.
   * - Ensure that you enable the RTMP Converter service before using
   * this function. See *Prerequisites* in the *Push Streams to CDN* guide.
   * - If you call the {@link setLiveTranscoding} method to set the
   * LiveTranscoding class for the first time, the SDK does not trigger the
   * transcodingUpdated callback.
   *
   * @param {TranscodingConfig} transcoding Sets the CDN live audio/video
   * transcoding settings. See {@link TranscodingConfig}.
   *
   *
   * @return {number}
   * - 0: Success.
   * - < 0: Failure.
   */
  setLiveTranscoding(transcoding: TranscodingConfig): number {
    return this.rtcEngine.setLiveTranscoding(transcoding);
  }

  // ===========================================================================
  // STREAM INJECTION
  // ===========================================================================
  /**
   * Adds a voice or video stream HTTP/HTTPS URL address to a live streaming.
   *
   * This method applies to the Native SDK v2.4.1 and later.
   *
   * If this method call is successful, the server pulls the voice or video
   * stream and injects it into a live channel.
   * This is applicable to scenarios where all audience members in the channel
   * can watch a live show and interact with each other.
   *
   * The `addInjectStreamUrl` method call triggers the following
   * callbacks:
   * - The local client:
   *  - streamInjectStatus, with the state of the injecting the online stream.
   *  - `userJoined (uid: 666)`, if the method call is successful and the online
   * media stream is injected into the channel.
   * - The remote client:
   *  - `userJoined (uid: 666)`, if the method call is successful and the online
   * media stream is injected into the channel.
   *
   * @note
   * - Only the host in the Live-braodcast profile can call this method.
   * - Ensure that you enable the RTMP Converter service before using this
   * function. See *Prerequisites* in the *Push Streams to CDN* guide.
   * - Ensure that the user joins a channel before calling this method.
   * - This method adds only one stream URL address each time it is called.
   *
   * @param {string} url The HTTP/HTTPS URL address to be added to the ongoing
   * live streaming. Valid protocols are RTMP, HLS, and FLV.
   * - Supported FLV audio codec type: AAC.
   * - Supported FLV video codec type: H264 (AVC).
   * @param {InjectStreamConfig} config The InjectStreamConfig object which
   * contains the configuration information for the added voice or video stream.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *  - `ERR_INVALID_ARGUMENT (2)`: The injected URL does not exist. Call this
   * method again to inject the stream and ensure that the URL is valid.
   *  - `ERR_NOT_READY (3)`: The user is not in the channel.
   *  - `ERR_NOT_SUPPORTED (4)`: The channel profile is not Live streaming.
   * Call the {@link setChannelProfile} method and set the channel profile to
   * Live streaming before calling this method.
   *  - `ERR_NOT_INITIALIZED (7)`: The SDK is not initialized. Ensure that
   * the `AgoraRtcEngine` object is initialized before using this method.
   */
  addInjectStreamUrl(url: string, config: InjectStreamConfig): number {
    return this.rtcEngine.addInjectStreamUrl(url, config);
  }

  /**
   * Removes the injected online media stream from a live streaming.
   *
   * @param {string} url HTTP/HTTPS URL address of the added stream to be
   * removed.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  removeInjectStreamUrl(url: string): number {
    return this.rtcEngine.removeInjectStreamUrl(url);
  }

  // ===========================================================================
  // DATA CHANNEL
  // ===========================================================================
  /**
   * Creates a data stream.
   *
   * Each user can create up to five data streams during the lifecycle of the
   * AgoraRtcEngine.
   *
   * **Note**:
   * Set both the `reliable` and `ordered` parameters to true or false. Do not
   * set one as true and the other as false.
   * @param {boolean} reliable Sets whether or not the recipients are
   * guaranteed to receive the data stream from the sender within five seconds:
   * - true: The recipients will receive data from the sender within 5 seconds.
   * If the recipient does not receive the sent data within 5 seconds, the data
   * channel will report an error to the application.
   * - false: There is no guarantee that the recipients receive the data stream
   * within five seconds and no error message is reported for any delay or
   * missing data stream.
   * @param {boolean} ordered Sets whether or not the recipients receive the
   * data stream in the sent order:
   * - true: The recipients receive the data stream in the sent order.
   * - false: The recipients do not receive the data stream in the sent order.
   * @return
   * - Returns the ID of the data stream, if this method call succeeds.
   * - < 0: Failure and returns an error code.
   */
  createDataStream(reliable: boolean, ordered: boolean): number {
    return this.rtcEngine.createDataStream(reliable, ordered);
  }

  /**
   * Sends data stream messages to all users in a channel.
   *
   * The SDK has the following restrictions on this method:
   * - Up to 30 packets can be sent per second in a channel with each packet
   * having a maximum size of 1 kB.
   * - Each client can send up to 6 kB of data per second.
   * - Each user can have up to five data streams simultaneously.
   *
   * A successful {@link sendStreamMessage} method call triggers the
   * streamMessage callback on the remote client, from which the remote user
   * gets the stream message.
   *
   * A failed {@link sendStreamMessage} method call triggers the
   * streamMessageError callback on the remote client.
   *
   * @note
   * This method applies only to the communication(`0`) profile or to the hosts in
   * the `1` (live streaming) profile.
   * If an audience in the `1` (live streaming) profile calls this method, the
   * audience may be switched to a host.
   * @param {number} streamId ID of the sent data stream, returned in the
   * {@link createDataStream} method.
   * @param {string} msg Data to be sent.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  sendStreamMessage(streamId: number, msg: string): number {
    return this.rtcEngine.sendStreamMessage(streamId, msg);
  }

  // ===========================================================================
  // CHANNEL MEDIA RELAY
  // ===========================================================================
  /**
   * Starts to relay media streams across channels.
   *
   * After a successful method call, the SDK triggers the
   * channelMediaRelayState and channelMediaRelayEvent callbacks,
   * and these callbacks report the states and events of the media stream
   * relay.
   *
   * - If the channelMediaRelayState callback reports the state code `1` and
   * the error code `0`, and the and the
   * `channelMediaRelayEvent`
   * callback reports the event code `4` in {@link ChannelMediaRelayEvent}, the
   * SDK starts relaying media streams between the original and the
   * destination channel.
   * - If the channelMediaRelayState callback  reports the state code `3` in
   * {@link ChannelMediaRelayState}, an exception occurs during the media
   * stream relay.
   *
   * @note
   * - Contact sales-us@agora.io before implementing this function.
   * - Call this method after the {@link joinChannel} method.
   * - This method takes effect only when you are a host in a
   * Live-broadcast channel.
   * - We do not support using string user accounts in this function.
   * - After a successful method call, if you want to call this method again,
   * ensure that you call the {@link stopChannelMediaRelay} method to quit
   * the current relay.
   *
   * @param config The configuration of the media stream relay:
   * {@link ChannelMediaRelayConfiguration}.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  startChannelMediaRelay(config: ChannelMediaRelayConfiguration): number {
    return this.rtcEngine.startChannelMediaRelay(config);
  }
  /**
   * Updates the channels for media stream relay.
   *
   * After the channel media relay starts, if you want to relay the media
   * stream to more channels, or leave the current relay channel, you can call
   * the {@link updateChannelMediaRelay} method.
   *
   * After a successful method call, the SDK triggers the
   * channelMediaRelayState callback with the state code `7` in
   * {@link ChannelMediaRelayEvent}.
   *
   * **Note**:
   *
   * Call this method after the {@link startChannelMediaRelay} method to
   * update the destination channel.
   *
   * @param config The media stream relay configuration:
   * {@link ChannelMediaRelayConfiguration}.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  updateChannelMediaRelay(config: ChannelMediaRelayConfiguration): number {
    return this.rtcEngine.updateChannelMediaRelay(config);
  }
  /**
   * Stops the media stream relay.
   *
   * Once the relay stops, the host quits all the destination channels.
   *
   * After a successful method call, the SDK triggers the
   * channelMediaRelayState callback. If the callback reports the state
   * code `0` and the error code `1`, the host
   * successfully stops the relay.
   *
   * **Note**:
   * If the method call fails, the SDK triggers the
   * channelMediaRelayState callback with the error code `2` and `8` in
   * {@link ChannelMediaRelayError}. You can leave the channel by calling
   * the {@link leaveChannel} method, and
   * the media stream relay automatically stops.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  stopChannelMediaRelay(): number {
    return this.rtcEngine.stopChannelMediaRelay();
  }

  // ===========================================================================
  // MANAGE AUDIO EFFECT
  // ===========================================================================
  /**
   * Retrieves the volume of the audio effects.
   *
   * The value ranges between 0.0 and 100.0.
   * @return
   * - ≥ 0: Volume of the audio effects, if this method call succeeds.
   * - < 0: Failure.
   */
  getEffectsVolume(): number {
    return this.rtcEngine.getEffectsVolume();
  }
  /**
   * Sets the volume of the audio effects.
   * @param {number} volume Sets the volume of the audio effects. The value
   * ranges between 0 and 100 (default).
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setEffectsVolume(volume: number): number {
    return this.rtcEngine.setEffectsVolume(volume);
  }
  /**
   * Sets the volume of a specified audio effect.
   * @param {number} soundId ID of the audio effect. Each audio effect has a
   * unique ID.
   * @param {number} volume Sets the volume of the specified audio effect.
   * The value ranges between 0.0 and 100.0 (default).
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setVolumeOfEffect(soundId: number, volume: number): number {
    return this.rtcEngine.setVolumeOfEffect(soundId, volume);
  }
  /**
   * Plays a specified local or online audio effect file.
   *
   * This method allows you to set the loop count, pitch, pan, and gain of the
   * audio effect file, as well as whether the remote user can hear the audio
   * effect.
   *
   * To play multiple audio effect files simultaneously, call this method
   * multiple times with different soundIds and filePaths.
   * We recommend playing no more than three audio effect files at the same
   * time.
   *
   * When the audio effect file playback finishes, the SDK returns the
   * audioEffectFinished callback.
   * @param {number} soundId ID of the specified audio effect. Each audio
   * effect has a unique ID.
   * @param {string} filePath TSpecifies the absolute path (including the
   * suffixes of the filename) to the local audio effect file or the URL of
   * the online audio effect file. Supported audio formats: mp3, mp4, m4a,
   * aac, 3gp, mkv and wav.
   * @param {number} loopcount Sets the number of times the audio effect
   * loops:
   * - 0: Play the audio effect once.
   * - 1: Play the audio effect twice.
   * - -1: Play the audio effect in an indefinite loop until the
   * {@link stopEffect} or {@link stopEffect} method is called.
   * @param {number} pitch Sets the pitch of the audio effect. The value ranges
   * between 0.5 and 2.
   * The default value is 1 (no change to the pitch). The lower the value, the
   * lower the pitch.
   * @param {number} pan Sets the spatial position of the audio effect. The
   * value ranges between -1.0 and 1.0:
   * - 0.0: The audio effect displays ahead.
   * - 1.0: The audio effect displays to the right.
   * - -1.0: The audio effect displays to the left.
   * @param {number} gain Sets the volume of the audio effect. The value ranges
   * between 0.0 and 100.0 (default).
   * The lower the value, the lower the volume of the audio effect.
   * @param {boolean} publish Sets whether or not to publish the specified
   * audio effect to the remote stream:
   * - true: The locally played audio effect is published to the Agora Cloud
   * and the remote users can hear it.
   * - false: The locally played audio effect is not published to the Agora
   * Cloud and the remote users cannot hear it.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  playEffect(
    soundId: number,
    filePath: string,
    loopcount: number,
    pitch: number,
    pan: number,
    gain: number,
    publish: number
  ): number {
    return this.rtcEngine.playEffect(
      soundId,
      filePath,
      loopcount,
      pitch,
      pan,
      gain,
      publish
    );
  }
  /**
   * Stops playing a specified audio effect.
   * @param {number} soundId ID of the audio effect to stop playing. Each
   * audio effect has a unique ID.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopEffect(soundId: number): number {
    return this.rtcEngine.stopEffect(soundId);
  }
  /**
   * Stops playing all audio effects.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  stopAllEffects(): number {
    return this.rtcEngine.stopAllEffects();
  }
  /**
   * Preloads a specified audio effect file into the memory.
   *
   * To ensure smooth communication, limit the size of the audio effect file.
   * We recommend using this method to preload the audio effect before calling
   * the {@link joinChannel} method.
   *
   * Supported audio formats: mp3, aac, m4a, 3gp, and wav.
   *
   * **Note**:
   * This method does not support online audio effect files.
   *
   * @param {number} soundId ID of the audio effect. Each audio effect has a
   * unique ID.
   * @param {string} filePath The absolute path of the audio effect file.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  preloadEffect(soundId: number, filePath: string): number {
    return this.rtcEngine.preloadEffect(soundId, filePath);
  }
  /**
   * Releases a specified preloaded audio effect from the memory.
   * @param {number} soundId ID of the audio effect. Each audio effect has a
   * unique ID.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  unloadEffect(soundId: number): number {
    return this.rtcEngine.unloadEffect(soundId);
  }
  /**
   * Pauses a specified audio effect.
   * @param {number} soundId ID of the audio effect. Each audio effect has a
   * unique ID.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  pauseEffect(soundId: number): number {
    return this.rtcEngine.pauseEffect(soundId);
  }
  /**
   * Pauses all the audio effects.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  pauseAllEffects(): number {
    return this.rtcEngine.pauseAllEffects();
  }
  /**
   * Resumes playing a specified audio effect.
   * @param {number} soundId sound id
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  resumeEffect(soundId: number): number {
    return this.rtcEngine.resumeEffect(soundId);
  }
  /**
   * Resumes playing all audio effects.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  resumeAllEffects(): number {
    return this.rtcEngine.resumeAllEffects();
  }

  /**
   * Enables/Disables stereo panning for remote users.
   *
   * Ensure that you call this method before {@link joinChannel} to enable
   * stereo panning
   * for remote users so that the local user can track the position of a
   * remote user
   * by calling {@link setRemoteVoicePosition}.
   * @param {boolean} enable Sets whether or not to enable stereo panning for
   * remote users:
   * - true: enables stereo panning.
   * - false: disables stereo panning.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableSoundPositionIndication(enable: boolean) {
    return this.rtcEngine.enableSoundPositionIndication(enable);
  }

  /**
   * Sets the sound position and gain of a remote user.
   *
   * When the local user calls this method to set the sound position of a
   * remote user, the sound difference between the left and right channels
   * allows
   * the local user to track the real-time position of the remote user,
   * creating a real sense of space. This method applies to massively
   * multiplayer online games, such as Battle Royale games.
   *
   * **Note**:
   * - For this method to work, enable stereo panning for remote users by
   * calling the {@link enableSoundPositionIndication} method before joining
   * a channel.
   * - This method requires hardware support. For the best sound positioning,
   * we recommend using a stereo speaker.
   * @param {number} uid The ID of the remote user.
   * @param {number} pan The sound position of the remote user. The value
   * ranges from -1.0 to 1.0:
   * - 0.0: The remote sound comes from the front.
   * - -1.0: The remote sound comes from the left.
   * - 1.0: The remote sound comes from the right.
   * @param {number} gain Gain of the remote user. The value ranges from 0.0
   * to 100.0. The default value is 100.0 (the original gain of the
   * remote user).
   * The smaller the value, the less the gain.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setRemoteVoicePosition(uid: number, pan: number, gain: number): number {
    return this.rtcEngine.setRemoteVoicePosition(uid, pan, gain);
  }

  // ===========================================================================
  // EXTRA
  // ===========================================================================

  /**
   * Retrieves the current call ID.
   * When a user joins a channel on a client, a `callId` is generated to
   * identify the call from the client.
   * Feedback methods, such as {@link rate} and {@link complain}, must be
   * called after the call ends to submit feedback to the SDK.
   *
   * The {@link rate} and {@link complain} methods require the `callId`
   * parameter retrieved from the {@link getCallId} method during a call.
   * `callId` is passed as an argument into the {@link rate} and
   * {@link complain} methods after the call ends.
   *
   * @return The current call ID.
   */
  getCallId(): string {
    return this.rtcEngine.getCallId();
  }

  /**
   * Allows a user to rate a call after the call ends.
   * @param {string} callId Pointer to the ID of the call, retrieved from
   * the {@link getCallId} method.
   * @param {number} rating Rating of the call. The value is between 1
   * (lowest score) and 5 (highest score).
   * @param {string} desc (Optional) Pointer to the description of the rating,
   * with a string length of less than 800 bytes.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  rate(callId: string, rating: number, desc: string): number {
    return this.rtcEngine.rate(callId, rating, desc);
  }

  /**
   * Allows a user to complain about the call quality after a call ends.
   * @param {string} callId Call ID retrieved from the {@link getCallId} method.
   * @param {string} desc (Optional) The description of the
   * complaint, with a string length of less than 800 bytes.
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  complain(callId: string, desc: string): number {
    return this.rtcEngine.complain(callId, desc);
  }
  //TODO(input)
  setRecordingAudioFrameParameters(sampleRate: number, channel: 1 | 2, mode: 0 | 1 | 2, samplesPerCall: number): number {
    return this.rtcEngine.setRecordingAudioFrameParameters(sampleRate, channel, mode, samplesPerCall);
  }

  // ===========================================================================
  // replacement for setParameters call
  // ===========================================================================
  /**
   * Private Interfaces.
   * @ignore
  */
  setBool(key: string, value: boolean): number {
    return this.rtcEngine.setBool(key, value);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  setInt(key: string, value: number): number {
    return this.rtcEngine.setInt(key, value);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  setUInt(key: string, value: number): number {
    return this.rtcEngine.setUInt(key, value);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  setNumber(key: string, value: number): number {
    return this.rtcEngine.setNumber(key, value);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  setString(key: string, value: string): number {
    return this.rtcEngine.setString(key, value);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  setObject(key: string, value: string): number {
    return this.rtcEngine.setObject(key, value);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  getBool(key: string): boolean {
    return this.rtcEngine.getBool(key);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  getInt(key: string): number {
    return this.rtcEngine.getInt(key);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  getUInt(key: string): number {
    return this.rtcEngine.getUInt(key);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  getNumber(key: string): number {
    return this.rtcEngine.getNumber(key);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  getString(key: string): string {
    return this.rtcEngine.getString(key);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  getObject(key: string): string {
    return this.rtcEngine.getObject(key);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  getArray(key: string): string {
    return this.rtcEngine.getArray(key);
  }
  /**
   * Provides technical preview functionalities or special customizations by
   * configuring the SDK with JSON options.
   *
   * The JSON options are not public by default. Agora is working on making
   * commonly used JSON options public in a standard way.
   *
   * @param param The parameter as a JSON string in the specified format.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setParameters(param: string): number {
    return this.rtcEngine.setParameters(param);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  convertPath(path: string): string {
    return this.rtcEngine.convertPath(path);
  }
  /**
   * Private Interfaces.
   * @ignore
   */
  setProfile(profile: string, merge: boolean): number {
    return this.rtcEngine.setProfile(profile, merge);
  }

  // ===========================================================================
  // plugin apis
  // ===========================================================================
  /**
   * @ignore
   */
  initializePluginManager(): number {
    return this.rtcEngine.initializePluginManager();
  }
  /**
   * @ignore
   */
  releasePluginManager(): number {
    return this.rtcEngine.releasePluginManager();
  }
  /**
   * @ignore
   */
  registerPlugin(info: PluginInfo): number {
    return this.rtcEngine.registerPlugin(info);
  }
  /**
   * @ignore
   */
  unregisterPlugin(pluginId: string): number {
    return this.rtcEngine.unregisterPlugin(pluginId);
  }
  /**
   * @ignore
   */
  getPlugins() {
    return this.rtcEngine.getPlugins().map(item => {
      return this.createPlugin(item.id)
    })
  }
  /**
   * @ignore
   * @param pluginId
   */
  createPlugin(pluginId: string): Plugin {
    return {
      id: pluginId,
      enable:() => {
        return this.enablePlugin(pluginId, true)
      },
      disable:() => {
        return this.enablePlugin(pluginId, false)
      },
      setParameter: (param: string) => {
        return this.setPluginParameter(pluginId, param)
      },
      getParameter: (paramKey: string) => {
        return this.getPluginParameter(pluginId, paramKey)
      }
    }
  }

  /**
   * @ignore
   * @param pluginId
   * @param enabled
   */
  enablePlugin(pluginId: string, enabled: boolean): number {
    return this.rtcEngine.enablePlugin(pluginId, enabled);
  }

  /**
   * @ignore
   * @param pluginId
   * @param param
   */
  setPluginParameter(pluginId: string, param: string): number {
    return this.rtcEngine.setPluginParameter(pluginId, param);
  }

  /**
   * @ignore
   * @param pluginId
   * @param paramKey
   */
  getPluginParameter(pluginId: string, paramKey: string): string {
    return this.rtcEngine.getPluginParameter(pluginId, paramKey);
  }
  /** Unregisters a media metadata observer.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  unRegisterMediaMetadataObserver(): number {
    return this.rtcEngine.unRegisterMediaMetadataObserver();
  }
  /** Registers a media metadata observer.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  registerMediaMetadataObserver(): number {
    const fire = (event: string, ...args: Array<any>) => {
      setImmediate(() => {
        this.emit(event, ...args);
      });
    };

    this.rtcEngine.addMetadataEventHandler((metadata: Metadata) => {
      fire('receiveMetadata', metadata);
    }, (metadata: Metadata) => {
      fire('sendMetadataSuccess', metadata);
    });
    return this.rtcEngine.registerMediaMetadataObserver();
  }
  /** Sends the media metadata.
   *
   * After calling the {@link registerMediaMetadataObserver} method, you can
   * call the `setMetadata` method to send the media metadata.
   *
   * If it is a successful sending, the sender receives the
   * `sendMetadataSuccess` callback, and the receiver receives the
   * `receiveMetadata` callback.
   *
   * @param metadata The media metadata.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  sendMetadata(metadata: Metadata): number {
    return this.rtcEngine.sendMetadata(metadata);
  }
  /** Sets the maximum size of the media metadata.
   *
   * After calling the {@link registerMediaMetadataObserver} method, you can
   * call the `setMaxMetadataSize` method to set the maximum size.
   *
   * @param size The maximum size of your metadata.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setMaxMetadataSize(size: number): number {
    return this.rtcEngine.setMaxMetadataSize(size);
  }
  /** Agora supports reporting and analyzing customized messages.
   *
   * @since v3.2.0
   *
   * This function is in the beta stage with a free trial. The ability
   * provided in its beta test version is reporting a maximum of 10 message
   * pieces within 6 seconds, with each message piece not exceeding 256 bytes
   * and each string not exceeding 100 bytes.
   *
   * To try out this function, contact support@agora.io and discuss the
   * format of customized messages with us.
   */
  sendCustomReportMessage(id: string, category: string, event: string, label: string, value: number): number {
    return this.rtcEngine.sendCustomReportMessage(id, category, event, label, value);
  }
  /** Enables/Disables the built-in encryption.
   *
   * @since v3.2.0
   *
   * In scenarios requiring high security, Agora recommends calling this
   * method to enable the built-in encryption before joining a channel.
   *
   * All users in the same channel must use the same encryption mode and
   * encryption key. Once all users leave the channel, the encryption key of
   * this channel is automatically cleared.
   *
   * **Note**:
   * - If you enable the built-in encryption, you cannot use the RTMP or
   * RTMPS streaming function.
   * - The SDK returns `-4` when the encryption mode is incorrect or
   * the SDK fails to load the external encryption library.
   * Check the enumeration or reload the external encryption library.
   *
   * @param enabled Whether to enable the built-in encryption:
   * - true: Enable the built-in encryption.
   * - false: Disable the built-in encryption.
   * @param config Configurations of built-in encryption schemas.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableEncryption(enabled: boolean, config: EncryptionConfig): number {
    return this.rtcEngine.enableEncryption(enabled, config);
  }
  /** Sets an SDK preset audio effect.
   *
   * @since v3.2.0
   *
   * Call this method to set an SDK preset audio effect for the local user
   * who sends an audio stream. This audio effect
   * does not change the gender characteristics of the original voice.
   * After setting an audio effect, all users in the
   * channel can hear the effect.
   *
   * You can set different audio effects for different scenarios.
   *
   * To achieve better audio effect quality, Agora recommends calling
   * {@link setAudioProfile}
   * and setting the `scenario` parameter to `3` before calling this method.
   *
   * **Note**:
   * - You can call this method either before or after joining a channel.
   * - Do not set the profile `parameter` of `setAudioProfile` to `1` or `6`;
   * otherwise, this method call fails.
   * - This method works best with the human voice. Agora does not recommend
   * using this method for audio containing music.
   * - If you call this method and set the `preset` parameter to enumerators
   * except `ROOM_ACOUSTICS_3D_VOICE` or `PITCH_CORRECTION`,
   * do not call {@link setAudioEffectParameters}; otherwise,
   * {@link setAudioEffectParameters}
   * overrides this method.
   * - After calling this method, Agora recommends not calling the following
   * methods, because they can override `setAudioEffectPreset`:
   *  - {@link setVoiceBeautifierPreset}
   *  - {@link setLocalVoiceReverbPreset}
   *  - {@link setLocalVoiceChanger}
   *  - {@link setLocalVoicePitch}
   *  - {@link setLocalVoiceEqualization}
   *  - {@link setLocalVoiceReverb}
   *
   * @param preset The options for SDK preset audio effects.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioEffectPreset(preset: AUDIO_EFFECT_PRESET): number {
    return this.rtcEngine.setAudioEffectPreset(preset);
  }

  /** Sets an SDK preset voice beautifier effect.
   *
   * @since v3.2.0
   *
   * Call this method to set an SDK preset voice beautifier effect for the
   * local user who sends an audio stream. After
   * setting a voice beautifier effect, all users in the channel can hear
   * the effect.
   *
   * You can set different voice beautifier effects for different scenarios.
   *
   * To achieve better audio effect quality, Agora recommends calling
   * {@link setAudioProfile} and
   * setting the `scenario` parameter to `3` and the `profile` parameter to
   * `4` or `5` before calling this method.
   *
   * @note
   * - You can call this method either before or after joining a channel.
   * - Do not set the `profile` parameter of {@link setAudioProfile} to
   * `1`
   * or `6`; otherwise, this method call fails.
   * - This method works best with the human voice. Agora does not recommend
   * using this method for audio containing music.
   * - After calling this method, Agora recommends not calling the following
   * methods, because they can override {@link setVoiceBeautifierPreset}:
   *  - {@link setAudioEffectPreset}
   *  - {@link setAudioEffectParameters}
   *  - {@link setLocalVoiceReverbPreset}
   *  - {@link setLocalVoiceChanger}
   *  - {@link setLocalVoicePitch}
   *  - {@link setLocalVoiceEqualization}
   *  - {@link setLocalVoiceReverb}
   *
   * @param preset The options for SDK preset voice beautifier effects.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setVoiceBeautifierPreset(preset: VOICE_BEAUTIFIER_PRESET): number {
    return this.rtcEngine.setVoiceBeautifierPreset(preset);
  }

  /** Sets parameters for SDK preset audio effects.
   *
   * @since v3.2.0
   *
   * Call this method to set the following parameters for the local user who
   * send an audio stream:
   * - 3D voice effect: Sets the cycle period of the 3D voice effect.
   * - Pitch correction effect: Sets the basic mode and tonic pitch of the
   * pitch correction effect. Different songs
   * have different modes and tonic pitches. Agora recommends bounding this
   * method with interface elements to enable
   * users to adjust the pitch correction interactively.
   *
   * After setting parameters, all users in the channel can hear the relevant
   * effect.
   *
   * You can call this method directly or after {@link setAudioEffectPreset}.
   * If you
   * call this method after {@link setAudioEffectPreset}, ensure that you set
   * the preset
   * parameter of {@link setAudioEffectPreset} to `ROOM_ACOUSTICS_3D_VOICE` or
   * `PITCH_CORRECTION` and then call this method
   * to set the same enumerator; otherwise, this method overrides
   * {@link setAudioEffectPreset}.
   *
   * @note
   * - You can call this method either before or after joining a channel.
   * - To achieve better audio effect quality, Agora recommends
   * calling {@link setAudioProfile}
   * and setting the `scenario` parameter to `3` before calling this method.
   * - Do not set the `profile` parameter of {@link setAudioProfile} to
   * `1` or
   * `6`; otherwise, this method call fails.
   * - This method works best with the human voice. Agora does not recommend
   * using this method for audio containing music.
   * - After calling this method, Agora recommends not calling the following
   * methods, because they can override `setAudioEffectParameters`:
   *  - {@link setAudioEffectPreset}
   *  - {@link setVoiceBeautifierPreset}
   *  - {@link setLocalVoiceReverbPreset}
   *  - {@link setLocalVoiceChanger}
   *  - {@link setLocalVoicePitch}
   *  - {@link setLocalVoiceEqualization}
   *  - {@link setLocalVoiceReverb}
   *
   * @param preset The options for SDK preset audio effects:
   * - 3D voice effect: `ROOM_ACOUSTICS_3D_VOICE`.
   *  - Call {@link setAudioProfile} and set the `profile` parameter to
   * `3`
   * or `5` before setting this enumerator; otherwise, the enumerator setting
   * does not take effect.
   *  - If the 3D voice effect is enabled, users need to use stereo audio
   * playback devices to hear the anticipated voice effect.
   * - Pitch correction effect: `PITCH_CORRECTION`. To achieve better audio
   *  effect quality, Agora recommends calling
   * {@link setAudioProfile} and setting the `profile` parameter to
   * `4` or
   * `5` before setting this enumerator.
   * @param param1
   * - If you set `preset` to `ROOM_ACOUSTICS_3D_VOICE`, the `param1` sets
   * the cycle period of the 3D voice effect.
   * The value range is [1,60] and the unit is a second. The default value is
   * 10 seconds, indicating that the voice moves
   * around you every 10 seconds.
   * - If you set `preset` to `PITCH_CORRECTION`, `param1` sets the basic
   * mode of the pitch correction effect:
   *  - `1`: (Default) Natural major scale.
   *  - `2`: Natural minor scale.
   *  - `3`: Japanese pentatonic scale.
   * @param param2
   * - If you set `preset` to `ROOM_ACOUSTICS_3D_VOICE`, you need to set
   * `param2` to `0`.
   * - If you set `preset` to `PITCH_CORRECTION`, `param2` sets the
   * tonic pitch of the pitch correction effect:
   *  - `1`: A
   *  - `2`: A#
   *  - `3`: B
   *  - `4`: (Default) C
   *  - `5`: C#
   *  - `6`: D
   *  - `7`: D#
   *  - `8`: E
   *  - `9`: F
   *  - `10`: F#
   *  - `11`: G
   *  - `12`: G#
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setAudioEffectParameters(preset: AUDIO_EFFECT_PRESET, param1: number, param2: number): number {
    return this.rtcEngine.setAudioEffectParameters(preset, param1, param2);
  }

  /** @since v3.4.0

  Enables/Disables capture image background subtitution and sets the options.

  @note
  - Call this method after calling the enableVideo method.

  @param enabled Sets whether or not to enable capture image background subtitution:
  - true: enables background subtitution.
  - false: disables background subtitution.
  @param options Sets the background source data. See VideoBackgroundSource.
  */
  setVideoBackgroundSource(enabled: boolean, backgroundSource: VideoBackgroundSource): number {
    return this.rtcEngine.setVideoBackgroundSource(enabled, backgroundSource);
  }

  addDllDirectory(filePath: string): number {
    return this.rtcEngine.addDllDirectory(filePath);
  }
}
/** The AgoraRtcEngine interface. */
declare interface AgoraRtcEngine {
  /**
   * Occurs when an API method is executed.
   *
   * `api`: The method executed by the SDK.
   *
   * `err`: Error code that the SDK returns when the method call fails.
   */
  on(evt: 'apiCallExecuted', cb: (api: string, err: number) => void): this;
  /**
   * Reports a warning during SDK runtime.
   * @param cb.warn Warning code.
   * @param cb.msg The warning message.
   */
  on(evt: 'warning', cb: (warn: number, msg: string) => void): this;
  /** Reports an error during SDK runtime.
   * @param cb.err Error code.
   * @param cb.msg The error message.
   */
  on(evt: 'error', cb: (err: number, msg: string) => void): this;
  /** Occurs when a user joins a specified channel.
   * @param cb.channel The channel name.
   * @param cb.uid User ID of the user joining the channel.
   * @param cb.elapsed Time elapsed (ms) from the user calling the
   * {@link joinChannel}
   * method until the SDK triggers this callback.
   */
  on(
    evt: 'joinedChannel',
    cb: (channel: string, uid: number, elapsed: number) => void
  ): this;
  /** Occurs when a user rejoins the channel after disconnection due to network
   * problems.
   * When a user loses connection with the server because of network problems,
   * the SDK automatically tries to reconnect and triggers this callback upon
   * reconnection.
   * @param cb.channel The channel name.
   * @param cb.uid User ID of the user joining the channel.
   * @param cb.elapsed Time elapsed (ms) from the user calling the
   * {@link joinChannel}
   * method until the SDK triggers this callback.
   */
  on(
    evt: 'rejoinedChannel',
    cb: (channel: string, uid: number, elapsed: number) => void
  ): this;
  // on(evt: 'audioQuality', cb: (
  //   uid: number, quality: AgoraNetworkQuality, delay: number, lost: number
  // ) => void): this;
  /**
   * @deprecated Deprecated. Use the `groupAudioVolumeIndication` callback
   * instead.
   */
  on(
    evt: 'audioVolumeIndication',
    cb: (
      uid: number,
      volume: number,
      speakerNumber: number,
      totalVolume: number
    ) => void
  ): this;
  /** Reports which users are speaking, the speakers' volume and whether the
   * local user is speaking.
   *
   * This callback reports the IDs and volumes of the loudest speakers
   * (at most 3 users) at the moment in the channel, and whether the local user
   * is speaking.
   *
   * By default, this callback is disabled. You can enable it by calling the
   * {@link enableAudioVolumeIndication} method.
   *
   * The SDK triggers two independent `groupudioVolumeIndication` callbacks at
   * one time, which separately report the volume information of the local user
   * and all the remote speakers. For more information, see the detailed
   * parameter descriptions.
   *
   * @note
   * - To enable the voice activity detection of the local user, ensure that
   * you set `report_vad(true)` in the `enableAudioVolumeIndication` method.
   * - Calling the {@link muteLocalAudioStream} method affects the SDK's
   * behavior:
   *  - If the local user calls `muteLocalAudioStream`, the SDK stops
   * triggering the local user's callback.
   *  - 20 seconds after a remote speaker calls `muteLocalAudioStream`, the
   * remote speakers' callback excludes this remote user's information; 20
   * seconds after all remote users call `muteLocalAudioStream`, the SDK stops
   * triggering the remote speakers' callback.
   *
   * @param cb.speakers The speakers' information:
   * - In the local client:
   *  - `uid`: 0.
   *  - `volume`: The volume of the local speaker.
   *  - `vad`: The voice activity status of the local user.
   * - In each remote client:
   *  - `uid`: The ID of the remote user.
   *  - `volume`: The sum of the voice volume and audio-mixing volume of
   * each remote speaker.
   *  - `vad`: 0.
   *
   * @param cb.speakerNumber Total number of speakers. The value range is
   * [0, 3].
   * - In the local client: 1.
   * - In each remote client: 3, the three loudest speakers.
   * @param cb.totalVolume Total volume after audio mixing. The value ranges
   * between 0 (lowest volume) and 255 (highest volume).
   * - In the local client: The sum of the voice volume and audio-mixing volume
   * of the local user.
   * - In each remote client: The sum of the voice volume and audio-mixing
   * volume of all the remote speakers.
   */
  on(
    evt: 'groupAudioVolumeIndication',
    cb: (
      speakers: {
        uid: number;
        volume: number;
        vad: number;
      }[],
      speakerNumber: number,
      totalVolume: number
    ) => void
  ): this;
  /** Occurs when the user leaves the channel. When the app calls the
   * {@link leaveChannel} method, the SDK uses
   * this callback to notify the app when the user leaves the channel.
   */
  on(evt: 'leaveChannel', cb: (stats: RtcStats) => void): this;
  /** Reports the statistics of the AgoraRtcEngine once every two seconds.
   *
   * @param cb.stats AgoraRtcEngine's statistics, see {@link RtcStats}
   */
  on(evt: 'rtcStats', cb: (stats: RtcStats) => void): this;
  /**
   * Reports the statistics of the local video streams.
   *
   * **Note**:
   *
   * If you have called the {@link enableDualStream} method, the
   * localVideoStats callback reports the statistics of the high-video
   * stream (high bitrate, and high-resolution video stream).
   *
   * - stats: The statistics of the local video stream. See
   * {@link LocalVideoStats}.
   */
  on(evt: 'localVideoStats', cb: (stats: LocalVideoStats) => void): this;
  /**
   * Reports the statistics of the local audio streams.
   *
   * The SDK triggers this callback once every two seconds.
   *
   * - stats: The statistics of the local audio stream. See
   * {@link LocalAudioStats}.
   */
  on(evt: 'localAudioStats', cb: (stats: LocalAudioStats) => void): this;
  /** Reports the statistics of the video stream from each remote user/host.
   *
   * @param cb.stats Statistics of the received remote video streams. See
   * {@link RemoteVideoState}.
   */
  on(evt: 'remoteVideoStats', cb: (stats: RemoteVideoStats) => void): this;
  /** Reports the statistics of the audio stream from each remote user/host.
   *
   * @param cb.stats Statistics of the received remote audio streams. See
   * {@link RemoteAudioStats}.
   */
  on(evt: 'remoteAudioStats', cb: (stats: RemoteAudioStats) => void): this;
  /**
   * @deprecated This callback is deprecated. Use remoteVideoStats instead.
   *
   * Reports the transport-layer statistics of each remote video stream.
   *
   * This callback reports the transport-layer statistics, such as the packet
   * loss rate and time delay, once every two seconds
   * after the local user receives the video packet from a remote user.
   * - stats: The transport-layer statistics. See
   * {@link RemoteVideoTransportStats}.
   */
  on(evt: 'remoteVideoTransportStats', cb: (stats: RemoteVideoTransportStats) => void): this;
  /**
   * @deprecated This callback is deprecated. Use remoteAudioStats instead.
   *
   * Reports the transport-layer statistics of each remote audio stream.
   *
   * @param cb.stats The transport-layer statistics. See
   * {@link RemoteAudioTransportStats}.
   */
  on(
    evt: 'remoteAudioTransportStats',
    cb: (stats: RemoteAudioTransportStats) => void
  ): this;
  /**
   * Occurs when the audio device state changes.
   * - deviceId: Pointer to the device ID.
   * - deviceType: Device type. See {@link MediaDeviceType}.
   * - deviceState: Device state：
   *
   *  - 1: The device is active
   *  - 2: The device is disabled.
   *  - 4: The device is not present.
   *  - 8: The device is unplugged.
   */
  on(
    evt: 'audioDeviceStateChanged',
    cb: (deviceId: string, deviceType: number, deviceState: number) => void
  ): this;
  // on(evt: 'audioMixingFinished', cb: () => void): this;
  /** Occurs when the state of the local user's audio mixing file changes.
   * - state: The state code.
   *  - 710: The audio mixing file is playing.
   *  - 711: The audio mixing file pauses playing.
   *  - 713: The audio mixing file stops playing.
   *  - 714: An exception occurs when playing the audio mixing file.
   *
   * - err: The error code.
   *  - 701: The SDK cannot open the audio mixing file.
   *  - 702: The SDK opens the audio mixing file too frequently.
   *  - 703: The audio mixing file playback is interrupted.
   *
   */
  on(
    evt: 'audioMixingStateChanged',
    cb: (state: number, err: number) => void
  ): this;
  /** Occurs when a remote user starts audio mixing.
   * When a remote user calls {@link startAudioMixing} to play the background
   * music, the SDK reports this callback.
   */
  on(evt: 'remoteAudioMixingBegin', cb: () => void): this;
  /** Occurs when a remote user finishes audio mixing. */
  on(evt: 'remoteAudioMixingEnd', cb: () => void): this;
  /** Occurs when the local audio effect playback finishes. */
  on(evt: 'audioEffectFinished', cb: (soundId: number) => void): this;
  /**
   * This callback is not work.
   *
   * Occurs when the video device state changes.
   * - deviceId: Pointer to the device ID.
   * - deviceType: Device type. See {@link MediaDeviceType}.
   * - deviceState: Device state：
   *
   *  - 1: The device is active.
   *  - 2: The device is disabled.
   *  - 4: The device is not present.
   *  - 8: The device is unplugged.
   */
  on(
    evt: 'videoDeviceStateChanged',
    cb: (deviceId: string, deviceType: number, deviceState: number) => void
  ): this;
  /**
   * Reports the last mile network quality of each user in the channel
   * once every two seconds.
   *
   * Last mile refers to the connection between the local device and Agora's
   * edge server.
   *
   * @param cb.uid User ID. The network quality of the user with this uid is
   * reported.
   * If uid is 0, the local network quality is reported.
   * @param cb.txquality Uplink transmission quality rating of the user in
   * terms of
   * the transmission bitrate, packet loss rate, average RTT (Round-Trip Time),
   * and jitter of the uplink network. See {@link AgoraNetworkQuality}.
   * @param cb.rxquality Downlink network quality rating of the user in terms
   * of the
   * packet loss rate, average RTT, and jitter of the downlink network.
   * See {@link AgoraNetworkQuality}.
   */
  on(
    evt: 'networkQuality',
    cb: (
      uid: number,
      txquality: AgoraNetworkQuality,
      rxquality: AgoraNetworkQuality
    ) => void
  ): this;
  /** Reports the last mile network quality of the local user once every two
   * seconds before the user joins the channel.
   * - quality: The last mile network quality. See {@link AgoraNetworkQuality}.
   *
   * Last mile refers to the connection between the local device and Agora's
   * edge server. After the application calls the
   * {@link enableLastmileTest} method,
   * this callback reports once every two seconds the uplink and downlink last
   * mile network conditions of the local user before the user joins the
   * channel.
   */
  on(evt: 'lastMileQuality', cb: (quality: AgoraNetworkQuality) => void): this;
  /** Reports the last-mile network probe result.
   * - result: The uplink and downlink last-mile network probe test result.
   * See {@link LastmileProbeResult}.
   *
   * The SDK triggers this callback within 30 seconds after the app calls
   * the {@link startLastmileProbeTest} method.
   */
  on(
    evt: 'lastmileProbeResult',
    cb: (result: LastmileProbeResult) => void
  ): this;
  /** Occurs when the first local video frame is displayed/rendered on the
   * local video view.
   *
   * - width: Width (px) of the first local video frame.
   * - height: Height (px) of the first local video frame.
   * - elapsed: Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
  on(
    evt: 'firstLocalVideoFrame',
    cb: (width: number, height: number, elapsed: number) => void
  ): this;
  /**
   * @deprecated This callback is deprecated. Use the remoteVideoStateChanged
   * callback instead.
   *
   * Occurs when the first remote video frame is received and decoded.
   * - uid: User ID of the remote user sending the video stream.
   * - elapsed: Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   * This callback is triggered in either of the following scenarios:
   * - The remote user joins the channel and sends the video stream.
   * - The remote user stops sending the video stream and re-sends it after
   * 15 seconds. Reasons for such an interruption include:
   *  - The remote user leaves the channel.
   *  - The remote user drops offline.
   *  - The remote user calls the {@link muteLocalVideoStream} method to stop
   * sending the video stream.
   *  - The remote user calls the {@link disableVideo} method to disable video.
   */
  on(evt: 'addStream', cb: (uid: number, elapsed: number) => void): this;
  /** Occurs when the video size or rotation of a specified user changes.
   * @param cb.uid User ID of the remote user or local user (0) whose video
   * size or
   * rotation changes.
   * @param cb.width New width (pixels) of the video.
   * @param cb.height New height (pixels) of the video.
   * @param cb.roation New height (pixels) of the video.
   */
  on(
    evt: 'videoSizeChanged',
    cb: (uid: number, width: number, height: number, rotation: number) => void
  ): this;
  /** @deprecated This callback is deprecated, please use
   * `remoteVideoStateChanged` instead.
   *
   * Occurs when the first remote video frame is rendered.
   *
   * The SDK triggers this callback when the first frame of the remote video
   * is displayed in the user's video window.
   *
   * @param cb.uid User ID of the remote user sending the video stream.
   * @param cb.width Width (pixels) of the video frame.
   * @param cb.height Height (pixels) of the video stream.
   * @param cb.elapsed Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
  on(
    evt: 'firstRemoteVideoFrame',
    cb: (uid: number, width: number, height: number, elapsed: number) => void
  ): this;
  /** Occurs when the first remote video frame is decoded.
   * The SDK triggers this callback when the first frame of the remote video
   * is decoded.
   * - uid: User ID of the remote user sending the video stream.
   * - width: Width (pixels) of the video frame.
   * - height: Height (pixels) of the video stream.
   * - elapsed: Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
  on(
    evt: 'firstRemoteVideoDecoded',
    cb: (uid: number, width: number, height: number, elapsed: number) => void
  ): this;
  /** Occurs when a user or host joins the channel.
   *
   * The SDK triggers this callback under one of the following circumstances:
   * - A remote user/host joins the channel by calling the {@link joinChannel}
   * method.
   * - A remote user switches the user role to the host by calling the
   * {@link setClientRole} method after joining the channel.
   * - A remote user/host rejoins the channel after a network interruption.
   * - The host injects an online media stream into the channel by calling
   * the {@link addInjectStreamUrl} method.
   *
   * @note In the `1` (live streaming) profile:
   * - The host receives this callback when another host joins the channel.
   * - The audience in the channel receives this callback when a new host
   * joins the channel.
   * - When a web application joins the channel, the SDK triggers this
   * callback as long as the web application publishes streams.
   *
   * @param cb.uid User ID of the user or host joining the channel.
   * @param cb.elapsed Time delay (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
  on(evt: 'userJoined', cb: (uid: number, elapsed: number) => void): this;
  /** Occurs when a remote user leaves the channel.
   * - uid: User ID of the user leaving the channel or going offline.
   * - reason: Reason why the user is offline:
   *  - 0: The user quits the call.
   *  - 1: The SDK times out and the user drops offline because no data packet
   * is received within a certain period of time.
   *  If the user quits the call and the message is not passed to the SDK
   * (due to an unreliable channel), the SDK assumes the user dropped offline.
   *  - 2: The client role switched from the host to the audience.
   * Reasons why the user is offline:
   * - Leave the channel: When the user leaves the channel, the user sends
   * a goodbye message. When the message is received, the SDK assumes that
   * the user leaves the channel.
   * - Drop offline: When no data packet of the user or host is received for
   * a certain period of time (20 seconds for the communication(`0`) profile,
   * and more for the `1` (live streaming) profile), the SDK assumes that the user
   * drops offline. Unreliable network connections may lead to false
   * detections, so we recommend using a signaling system for more reliable
   * offline detection.
   */
  on(evt: 'removeStream', cb: (uid: number, reason: number) => void): this;
  /** Occurs when a remote user (Communication)/host (Live streaming) leaves
   * the channel.
   *
   * There are two reasons for users to become offline:
   * - Leave the channel: When the user/host leaves the channel, the user/host
   * sends a goodbye message. When this message is received, the SDK determines
   * that the user/host leaves the channel.
   * - Drop offline: When no data packet of the user or host is received for a
   * certain period of time, the SDK assumes that the user/host drops
   * offline. A poor network connection may lead to false detections, so we
   * recommend using the signaling system for reliable offline detection.
   *
   * @param cb.uid ID of the user or host who leaves the channel or goes
   * offline.
   * @param cb.reason Reason why the user goes offline:
   *  - The user left the current channel.
   *  - The SDK timed out and the user dropped offline because no data packet
   * was received within a certain period of time. If a user quits the call
   * and the message is not passed to the SDK (due to an unreliable channel),
   * the SDK assumes the user dropped offline.
   *  - (Live streaming only.) The client role switched from the host to the
   * audience.
   */
  on(evt: 'userOffline', cb: (uid: number, reason: number) => void): this;
  /** @deprecated This callback is deprecated, please use
   * `remoteAudioStateChanged` instead.
   *
   * Occurs when a remote user's audio stream is muted/unmuted.
   *
   * The SDK triggers this callback when the remote user stops or resumes
   * sending the audio stream by calling the {@link muteLocalAudioStream}
   * method.
   * - uid: User ID of the remote user.
   * - muted: Whether the remote user's audio stream is muted/unmuted:
   *  - true: Muted.
   *  - false: Unmuted.
   */
  on(evt: 'userMuteAudio', cb: (uid: number, muted: boolean) => void): this;

  /**
   * Occurs when a remote user's video stream playback pauses/resumes.
   *
   * The SDK triggers this callback when the remote user stops or resumes
   * sending the video stream by calling the {@link muteLocalVideoStream}
   * method.
   *
   * - uid: User ID of the remote user.
   * - muted: Whether the remote user's video stream playback is paused/resumed:
   *  - true: Paused.
   *  - false: Resumed.
   *
   * **Note**: This callback returns invalid when the number of users in a
   * channel exceeds 20.
   */
  on(evt: 'userMuteVideo', cb: (uid: number, muted: boolean) => void): this;
  /**
   * @deprecated This callback is deprecated. Use the remoteVideoStateChanged
   * callback instead.
   *
   * Occurs when a specific remote user enables/disables the video module.
   *
   * The SDK triggers this callback when the remote user enables or disables
   * the video module by calling the {@link enableVideo} or
   * {@link disableVideo} method.
   * - uid: User ID of the remote user.
   * - enabled: Whether the remote user enables/disables the video module:
   *  - true: Enable. The remote user can enter a video session.
   *  - false: Disable. The remote user can only enter a voice session, and
   * cannot send or receive any video stream.
   */
  on(evt: 'userEnableVideo', cb: (uid: number, enabled: boolean) => void): this;
  /**
   * @deprecated This callback is deprecated. Use the remoteVideoStateChanged
   * callback instead.
   *
   * Occurs when a specified remote user enables/disables the local video
   * capturing function.
   *
   * The SDK triggers this callback when the remote user resumes or stops
   * capturing the video stream by calling the {@link enableLocalVideo} method.
   * - uid: User ID of the remote user.
   * - enabled: Whether the remote user enables/disables the local video
   * capturing function:
   *  - true: Enable. Other users in the channel can see the video of this
   * remote user.
   *  - false: Disable. Other users in the channel can no longer receive the
   * video stream from this remote user, while this remote user can still
   * receive the video streams from other users.
   */
  on(
    evt: 'userEnableLocalVideo',
    cb: (uid: number, enabled: boolean) => void
  ): this;
  /**
   * @deprecated Replaced by the localVideoStateChanged callback.
   * Occurs when the camera turns on and is ready to capture the video.
   */
  on(evt: 'cameraReady', cb: () => void): this;
  /**
   * @deprecated Replaced by the localVideoStateChanged callback.
   * Occurs when the video stops playing.
   */
  on(evt: 'videoStopped', cb: () => void): this;
  /** Occurs when the SDK cannot reconnect to Agora's edge server 10 seconds
   * after its connection to the server is interrupted.
   *
   * The SDK triggers this callback when it cannot connect to the server 10
   * seconds after calling the {@link joinChannel} method, whether or not it
   * is in the channel.
   * - If the SDK fails to rejoin the channel 20 minutes after being
   * disconnected from Agora's edge server, the SDK stops rejoining the
   * channel.
   */
  on(evt: 'connectionLost', cb: () => void): this;
  // on(evt: 'connectionInterrupted', cb: () => void): this;
  /**
   * @deprecated Replaced by the connectionStateChanged callback.
   * Occurs when your connection is banned by the Agora Server.
   */
  on(evt: 'connectionBanned', cb: () => void): this;
  // on(evt: 'refreshRecordingServiceStatus', cb: () => void): this;
  /** Occurs when the local user receives the data stream from the remote
   * user within five seconds.
   *
   * The SDK triggers this callback when the local user receives the stream
   * message that the remote user sends by calling the
   * {@link sendStreamMessage} method.
   * @param cb.uid User ID of the remote user sending the message.
   * @param cb.streamId Stream ID.
   * @param cb.msg The data received bt the local user.
   * @param cb.len Length of the data in bytes.
   */
  on(
    evt: 'streamMessage',
    cb: (uid: number, streamId: number, msg: string, len: number) => void
  ): this;
  /** Occurs when the local user does not receive the data stream from the
   * remote user within five seconds.
   *
   * The SDK triggers this callback when the local user fails to receive the
   * stream message that the remote user sends by calling the
   * {@link sendStreamMessage} method.
   *
   * @param cb.uid User ID of the remote user sending the message.
   * @param cb.streamId Stream ID.
   * @param cb.err Error code.
   * @param cb.missed Number of the lost messages.
   * @param cb.cached Number of incoming cached messages when the data stream
   * is interrupted.
   */
  on(
    evt: 'streamMessageError',
    cb: (
      uid: number,
      streamId: number,
      code: number,
      missed: number,
      cached: number
    ) => void
  ): this;
  /** Occurs when the media engine call starts. */
  on(evt: 'mediaEngineStartCallSuccess', cb: () => void): this;
  /** Occurs when the token expires.
   *
   * After a token(channel key) is specified by calling the {@link joinChannel}
   * method,
   * if the SDK losses connection with the Agora server due to network issues,
   * the token may expire after a certain period
   * of time and a new token may be required to reconnect to the server.
   *
   * This callback notifies the application to generate a new token. Call
   * the {@link renewToken} method to renew the token
   */
  on(evt: 'requestChannelKey', cb: () => void): this;
  /** Occurs when the engine sends the first local audio frame.
   *
   * @deprecated This callback is deprecated from v3.2.0. Use
   * the `firstLocalAudioFramePublished` instead.
   *
   * - elapsed: Time elapsed (ms) from the local user calling
   * {@link joinChannel} until the
   * SDK triggers this callback.
   */
  on(evt: 'firstLocalAudioFrame', cb: (elapsed: number) => void): this;
  /**
   * @deprecated This callback is deprecated. Please use
   * `remoteAudioStateChanged` instead.
   *
   * Occurs when the engine receives the first audio frame from a specific
   * remote user.
   * - uid: User ID of the remote user.
   * - elapsed: Time elapsed (ms) from the local user calling
   * {@link joinChannel} until the
   * SDK triggers this callback.
   */
  on(
    evt: 'firstRemoteAudioFrame',
    cb: (uid: number, elapsed: number) => void
  ): this;
  /** @deprecated This callback is deprecated, please use
   * `remoteAudioStateChanged` instead.
   *
   * Occurs when the engine receives the first audio frame from a specified
   * remote user.
   * @param cb.uid User ID of the remote user sending the audio stream.
   * @param cb.elapsed The time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
  on(
    evt: 'firstRemoteAudioDecoded',
    cb: (uid: number, elapsed: number) => void
  ): this;
  /**
   * Reports which user is the loudest speaker.
   *
   * This callback returns the user ID of the user with the highest voice
   * volume during a period of time, instead of at the moment.
   *
   * @note To receive this callback, you need to call the
   * {@link enableAudioVolumeIndication} method.
   *
   * @param cb.uid User ID of the active speaker. A uid of 0 represents the
   * local user.
   * If the user enables the audio volume indication by calling the
   * {@link enableAudioVolumeIndication} method, this callback returns the uid
   * of the
   * active speaker detected by the audio volume detection module of the SDK.
   *
   */
  on(evt: 'activeSpeaker', cb: (uid: number) => void): this;
  /** Occurs when the user role switches in a live streaming.
   *
   * For example,
   * from a host to an audience or vice versa.
   *
   * This callback notifies the application of a user role switch when the
   * application calls the {@link setClientRole} method.
   *
   * @param cb.oldRole The old role, see {@link ClientRoleType}
   * @param cb.newRole The new role, see {@link ClientRoleType}
   */
  on(
    evt: 'clientRoleChanged',
    cb: (oldRole: ClientRoleType, newRole: ClientRoleType) => void
  ): this;
  /** Occurs when the volume of the playback device, microphone, or
   * application changes.
   * - deviceType: Device type. See {
   * @link AgoraRtcEngine.MediaDeviceType MediaDeviceType}.
   * - volume: Volume of the device. The value ranges between 0 and 255.
   * - muted:
   *  - true: Volume of the device. The value ranges between 0 and 255.
   *  - false: The audio device is not muted.
   */
  on(
    evt: 'audioDeviceVolumeChanged',
    cb: (deviceType: MediaDeviceType, volume: number, muted: boolean) => void
  ): this;
  /** Occurs when the user for sharing screen joined the channel.
   * - uid: The User ID.
   */
  on(evt: 'videoSourceJoinedSuccess', cb: (uid: number) => void): this;
  /** Occurs when the token expires. */
  on(evt: 'videoSourceRequestNewToken', cb: () => void): this;
  /** Occurs when the user for sharing screen leaved the channel.
   * - uid: The User ID.
   */
  on(evt: 'videoSourceLeaveChannel', cb: () => void): this;
  /** Occurs when the remote video state changes.
   *
   * @param cb.uid ID of the user whose video state changes.
   * @param cb.state State of the remote video.
   * See {@link RemoteVideoState}.
   * @param cb.reason The reason of the remote video state change.
   * See {@link RemoteVideoStateReason}
   * @param cb.elapsed Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
  on(
    evt: 'remoteVideoStateChanged',
    cb: (
      uid: number,
      state: RemoteVideoState,
      reason: RemoteVideoStateReason,
      elapsed: number
    ) => void
  ): this;
  /** Occurs when the camera focus area changes.
   * - x: x coordinate of the changed camera focus area.
   * - y: y coordinate of the changed camera focus area.
   * - width: Width of the changed camera focus area.
   * - height: Height of the changed camera focus area.
   */
  on(
    evt: 'cameraFocusAreaChanged',
    cb: (x: number, y: number, width: number, height: number) => void
  ): this;
  /** Occurs when the camera exposure area changes.
   * - x: x coordinate of the changed camera exposure area.
   * - y: y coordinate of the changed camera exposure area.
   * - width: Width of the changed camera exposure area.
   * - height: Height of the changed camera exposure area.
   */
  on(
    evt: 'cameraExposureAreaChanged',
    cb: (x: number, y: number, width: number, height: number) => void
  ): this;
  /** Occurs when the token expires in 30 seconds.
   *
   * The user becomes offline if the token used in the {@link joinChannel}
   * method expires. The SDK triggers this callback 30 seconds
   * before the token expires to remind the application to get a new token.
   * Upon receiving this callback, generate a new token
   * on the server and call the {@link renewToken} method to pass the new
   * token to the SDK.
   *
   * @param cb.token The token that expires in 30 seconds.
   */
  on(evt: 'tokenPrivilegeWillExpire', cb: (token: string) => void): this;
  /** @deprecated This callback is deprecated. Please use
   * `rtmpStreamingStateChanged` instead.
   *
   * Reports the result of CDN live streaming.
   *
   * - url: The RTMP URL address.
   * - error: Error code:
   *  - 0: The publishing succeeds.
   *  - 1: The publishing fails.
   *  - 2: Invalid argument used. For example, you did not call
   * {@link setLiveTranscoding} to configure LiveTranscoding before
   * calling {@link addPublishStreamUrl}.
   *  - 10: The publishing timed out.
   *  - 19: The publishing timed out.
   *  - 130: You cannot publish an encrypted stream.
   */
  on(evt: 'streamPublished', cb: (url: string, error: number) => void): this;
  /** @deprecated This callback is deprecated. Please use
   * `rtmpStreamingStateChanged` instead.
   *
   * This callback indicates whether you have successfully removed an RTMP
   * stream from the CDN.
   *
   * Reports the result of calling the {@link removePublishStreamUrl} method.
   * - url: The RTMP URL address.
   */
  on(evt: 'streamUnpublished', cb: (url: string) => void): this;
  /**
   * Occurs when the state of the RTMP streaming changes.
   *
   * The SDK triggers this callback to report the result of the local user
   * calling the {@link addPublishStreamUrl} and {@link removePublishStreamUrl}
   * method.
   *
   * This callback indicates the state of the RTMP streaming. When exceptions
   * occur, you can troubleshoot issues by referring to the detailed error
   * descriptions in the `code` parameter.
   * @param cb.url The RTMP URL address.
   * @param cb.state The RTMP streaming state:
   * - `0`: The RTMP streaming has not started or has ended. This state is also
   * triggered after you remove an RTMP address from the CDN by calling
   * {@link removePublishStreamUrl}.
   * - `1`: The SDK is connecting to Agora's streaming server and the RTMP
   * server. This state is triggered after you call the
   * {@link addPublishStreamUrl} method.
   * - `2`: The RTMP streaming publishes. The SDK successfully publishes the
   * RTMP streaming and returns this state.
   * - `3`: The RTMP streaming is recovering. When exceptions occur to the CDN,
   * or the streaming is interrupted, the SDK tries to resume RTMP streaming
   * and returns this state.
   *  - If the SDK successfully resumes the streaming, `2` returns.
   *  - If the streaming does not resume within 60 seconds or server errors
   * occur, `4` returns. You can also reconnect to the server by calling the
   * {@link removePublishStreamUrl} and then {@link addPublishStreamUrl}
   * method.
   * - `4`: The RTMP streaming fails. See the `code` parameter for the
   * detailed error information. You can also call the
   * {@link addPublishStreamUrl} method to publish the RTMP streaming again.
   * @param cb.code The detailed error information:
   * - `0`: The RTMP streaming publishes successfully.
   * - `1`: Invalid argument used.
   * - `2`: The RTMP streams is encrypted and cannot be published.
   * - `3`: Timeout for the RTMP streaming. Call the
   * {@link addPublishStreamUrl} to publish the stream again.
   * - `4`: An error occurs in Agora's streaming server. Call the
   * {@link addPublishStreamUrl} to publish the stream again.
   * - `5`: An error occurs in the RTMP server.
   * - `6`: The RTMP streaming publishes too frequently.
   * - `7`: The host publishes more than 10 URLs. Delete the unnecessary URLs
   * before adding new ones.
   * - `8`: The host manipulates other hosts' URLs. Check your app
   * logic.
   * - `9`: Agora's server fails to find the RTMP stream.
   * - `10`: The format of the stream's URL address is not supported. Check
   * whether the URL format is correct.
   */
  on(evt: 'rtmpStreamingStateChanged', cb: (url: string, state: number, code: number) => void): this;
  /** Occurs when the publisher's transcoding is updated.
   *
   * When the LiveTranscoding class in the setLiveTranscoding method updates,
   * the SDK triggers the transcodingUpdated callback to report the update
   * information to the local host.
   *
   * **Note**: If you call the {@link setLiveTranscoding} method to set the
   * LiveTranscoding class for the first time, the SDK does not trigger the
   * transcodingUpdated callback.
   */
  on(evt: 'transcodingUpdated', cb: () => void): this;
  /** Occurs when a voice or video stream URL address is added to a live
   * broadcast.
   * - url: Pointer to the URL address of the externally injected stream.
   * - uid: User ID.
   * - status: State of the externally injected stream:
   *  - 0: The external video stream imported successfully.
   *  - 1: The external video stream already exists.
   *  - 2: The external video stream to be imported is unauthorized.
   *  - 3: Import external video stream timeout.
   *  - 4: Import external video stream failed.
   *  - 5: The external video stream stopped importing successfully.
   *  - 6: No external video stream is found.
   *  - 7: No external video stream is found.
   *  - 8: Stop importing external video stream timeout.
   *  - 9: Stop importing external video stream failed.
   *  - 10: The external video stream is corrupted.
   *
   */
  on(
    evt: 'streamInjectStatus',
    cb: (url: string, uid: number, status: number) => void
  ): this;
  /** Occurs when the locally published media stream falls back to an
   * audio-only stream due to poor network conditions or switches back
   * to the video after the network conditions improve.
   *
   * If you call {@link setLocalPublishFallbackOption} and set option as
   * AUDIO_ONLY(2), the SDK triggers this callback when
   * the locally published stream falls back to audio-only mode due to poor
   * uplink conditions, or when the audio stream switches back to
   * the video after the uplink network condition improves.
   *
   * - isFallbackOrRecover: Whether the locally published stream falls back to
   * audio-only or switches back to the video:
   *  - true: The locally published stream falls back to audio-only due to poor
   * network conditions.
   *  - false: The locally published stream switches back to the video after
   * the network conditions improve.
   */
  on(evt: 'localPublishFallbackToAudioOnly', cb: (isFallbackOrRecover: boolean) => void): this;
  /** Occurs when the remote media stream falls back to audio-only stream due
   * to poor network conditions or switches back to the video stream after the
   * network conditions improve.
   *
   * If you call {@link setRemoteSubscribeFallbackOption} and set option as
   * AUDIO_ONLY(2), the SDK triggers this callback when
   * the remotely subscribed media stream falls back to audio-only mode due to
   * poor uplink conditions, or when the remotely subscribed media stream
   * switches back to the video after the uplink network condition improves.
   * @param cb.uid ID of the remote user sending the stream.
   * @param cb.isFallbackOrRecover Whether the remote media stream falls back
   * to audio-only or switches back to the video:
   *  - `true`: The remote media stream falls back to audio-only due to poor
   * network conditions.
   *  - `false`: The remote media stream switches back to the video stream
   * after the network conditions improved.
   */
  on(evt: 'remoteSubscribeFallbackToAudioOnly', cb: (
    uid: number,
    isFallbackOrRecover: boolean
  ) => void): this;
  /**
   * @deprecated This callback is deprecated. Use the localAudioStateChanged
   * callback instead.
   *
   * Occurs when the microphone is enabled/disabled.
   * - enabled: Whether the microphone is enabled/disabled:
   *  - true: Enabled.
   *  - false: Disabled.
   */
  on(evt: 'microphoneEnabled', cb: (enabled: boolean) => void): this;
  /** Occurs when the connection state between the SDK and the server changes.
   * @param cb.state The connection state, see {@link ConnectionState}.
   * @param cb.reason The connection reason, see {@link ConnectionState}.
   */
  on(evt: 'connectionStateChanged', cb: (
    state: ConnectionState,
    reason: ConnectionChangeReason
  ) => void): this;
  /** Occurs when the local user successfully registers a user account by
   * calling the {@link registerLocalUserAccount} method.
   * This callback reports the user ID and user account of the local user.
   * - uid: The ID of the local user.
   * - userAccount: The user account of the local user.
   */
  on(
    evt: 'localUserRegistered',
    cb: (uid: number, userAccount: string) => void
  ): this;
  /** Occurs when the SDK gets the user ID and user account of the remote user.
   *
   * After a remote user joins the channel, the SDK gets the UID and user
   * account of the remote user, caches them in a mapping table
   * object (UserInfo), and triggers this callback on the local client.
   * - uid: The ID of the remote user.
   * - userInfo: The UserInfo Object that contains the user ID and user
   * account of the remote user.
   */
  on(
    evt: 'userInfoUpdated',
    cb: (uid: number, userInfo: UserInfo) => void
  ): this;
  /**
   * Occurs when the local video state changes.
   *
   * This callback indicates the state of the local video stream, including
   * camera capturing and video encoding, and allows you to troubleshoot
   * issues when exceptions occur.
   *
   * @note Windows: For some device models, the SDK will not trigger this
   * callback when the state of the local video changes while the local video
   * capturing device is in use, so you have to make your own timeout judgment.
   *
   * @param cb.localVideoState The local video state:
   *  - 0: The local video is in the initial state.
   *  - 1: The local video capturer starts successfully. The SDK also reports
   * this state when you share a maximized window by calling
   * {@link startScreenCaptureByWindow}.
   *  - 2:  The first video frame is successfully encoded.
   *  - 3: The local video fails to start.
   *
   * @param cb.error The detailed error information of the local video:
   *  - 0: The local video is normal.
   *  - 1: No specified reason for the local video failure.
   *  - 2: No permission to use the local video device.
   *  - 3: The local video capturer is in use.
   *  - 4: The local video capture fails. Check whether the capturer is
   * working properly.
   *  - 5: The local video encoding fails.
   *  - 11: The shared window is minimized when you call
   * {@link startScreenCaptureByWindow} to share a window.
   *  - 12: The error code indicates that a window shared by the window ID has
   * been closed, or a full-screen window
   * shared by the window ID has exited full-screen mode.
   * After exiting full-screen mode, remote users cannot see the shared window.
   * To prevent remote users from seeing a
   * black screen, Agora recommends that you immediately stop screen sharing.
   * Common scenarios for reporting this error code:
   *   - When the local user closes the shared window, the SDK reports this
   * error code.
   *   - The local user shows some slides in full-screen mode first, and then
   * shares the windows of the slides. After
   * the user exits full-screen mode, the SDK reports this error code.
   *   - The local user watches web video or reads web document in full-screen
   * mode first, and then shares the window of
   * the web video or document. After the user exits full-screen mode, the
   * SDK reports this error code.
   */
  on(evt: 'localVideoStateChanged', cb: (
    localVideoState: number,
    error: number
  ) => void): this;
  /**
   * Occurs when the local audio state changes.
   *
   * This callback indicates the state change of the local audio stream,
   * including the state of the audio recording and encoding, and allows you
   * to troubleshoot issues when exceptions occur.
   *
   * **Note**:
   * When the state is 3 in the `state` code, see the `error` code.
   *
   * - state State of the local audio:
   *  - 0: The local audio is in the initial state.
   *  - 1: The recording device starts successfully.
   *  - 2: The first audio frame encodes successfully.
   *  - 3: The local audio fails to start.
   *
   * - error The error information of the local audio:
   *  - 0: The local audio is normal.
   *  - 1: No specified reason for the local audio failure.
   *  - 2: No permission to use the local audio device.
   *  - 3: The microphone is in use.
   *  - 4: The local audio recording fails. Check whether the recording device
   * is working properly.
   *  - 5: The local audio encoding fails.
   */
  on(evt: 'localAudioStateChanged', cb: (
    state: number,
    error: number
  ) => void): this;
  /**
   * Occurs when the remote audio state changes.
   *
   * This callback indicates the state change of the remote audio stream.
   *
   * @param cb.uid ID of the remote user whose audio state changes.
   *
   * @param cb.state State of the remote audio:
   * {@link RemoteAudioState}.
   *
   * @param cb.reason The reason of the remote audio state change:
   * {@link RemoteAudioStateReason}.
   *
   * @param cb.elapsed Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
  on(evt: 'remoteAudioStateChanged', cb: (
    uid: number,
    state: RemoteAudioState,
    reason: RemoteAudioStateReason,
    elapsed: number
  ) => void): this;
  /**
   * Occurs when the state of the media stream relay changes.
   *
   * The SDK reports the state of the current media relay and possible error
   * messages in this callback.
   *
   * @param cb.state The state code. See {@link ChannelMediaRelayState}.
   * @param cb.code The error code. See {@link ChannelMediaRelayError}.
   */
  on(evt: 'channelMediaRelayState', cb: (
    state: ChannelMediaRelayState,
    code: ChannelMediaRelayError
  ) => void): this;
  /**
   * Reports events during the media stream relay.
   *
   * @param cb.event The event code. See {@link ChannelMediaRelayEvent}.
   */
  on(evt: 'channelMediaRelayEvent', cb: (
    event: ChannelMediaRelayEvent
  ) => void): this;
  /** Receives the media metadata.
   *
   * After the sender sends the media metadata by calling the
   * {@link sendMetadata} method and the receiver receives the media metadata,
   * the SDK triggers this callback and reports the metadata to the receiver.
   *
   * @param cb.metadata The media metadata.
   */
  on(evt: 'receiveMetadata', cb: (
    metadata: Metadata
    ) => void): this;
  /** Sends the media metadata successfully.
   *
   * After the sender sends the media metadata successfully by calling the
   * {@link sendMetadata} method, the SDK triggers this calback to reports the
   * media metadata to the sender.
   *
   * @param cb.metadata The media metadata.
   */
  on(evt: 'sendMetadataSuccess', cb: (
    metadata: Metadata
    ) => void): this;
 /** Occurs when the first audio frame is published.
  *
  * @since v3.2.0
  *
  * The SDK triggers this callback under one of the following circumstances:
  * - The local client enables the audio module and calls {@link joinChannel}
  * successfully.
  * - The local client calls
  * {@link muteLocalAudioStream muteLocalAudioStream(true)} and
  * {@link muteLocalAudioStream muteLocalAudioStream(false)} in sequence.
  * - The local client calls {@link disableAudio} and {@link enableAudio}
  * in sequence.
  *
  * @param cb.elapsed The time elapsed (ms) from the local client calling
  * {@link joinChannel} until the SDK triggers this callback.
  */
  on(evt: 'firstLocalAudioFramePublished', cb: (
    elapsed: number
  )=>void): this;
  /** Occurs when the first video frame is published.
   *
   * @since v3.2.0
   *
   * The SDK triggers this callback under one of the following circumstances:
   * - The local client enables the video module and calls {@link joinChannel}
   * successfully.
   * - The local client calls
   * {@link muteLocalVideoStream muteLocalVideoStream(true)}and
   * {@link muteLocalVideoStream muteLocalVideoStream(false)} in sequence.
   * - The local client calls {@link disableVideo} and {@link enableVideo}
   * in sequence.
   *
   * @param cb.elapsed The time elapsed (ms) from the local client calling
   * {@link joinChannel} until the SDK triggers this callback.
   */
  on(evt: 'firstLocalVideoFramePublished', cb: (
    elapsed: number
  )=>void): this;
 /** Reports events during the RTMP or RTMPS streaming.
  *
  * @since v3.2.0
  *
  * @param cb.url The RTMP or RTMPS streaming URL.
  * @param cb.eventCode The event code.
  */
  on(evt: 'rtmpStreamingEvent', cb: (
    url: string,
    eventCode: RTMP_STREAMING_EVENT
  )=>void): this;
  /** Occurs when the audio publishing state changes.
   *
   * @since v3.2.0
   *
   * This callback indicates the publishing state change of the local audio
   * stream.
   *
   * @param cb.channel The channel name.
   * @param cb.oldState The previous publishing state.
   * @param cb.newState The current publishing state.
   * @param cb.elapseSinceLastState The time elapsed (ms) from the previous state
   * to the current state.
   */
  on(evt: 'audioPublishStateChanged', cb: (
    channel: string,
    oldState: STREAM_PUBLISH_STATE,
    newState: STREAM_PUBLISH_STATE,
    elapseSinceLastState: number
  )=> void): this;
  /** Occurs when the video publishing state changes.
   *
   * @since v3.2.0
   *
   * This callback indicates the publishing state change of the local video
   * stream.
   *
   * @param cb.channel The channel name.
   * @param cb.oldState The previous publishing state.
   * @param cb.newState The current publishing state.
   * @param cb.elapseSinceLastState The time elapsed (ms) from the previous state
   * to the current state.
   */
  on(evt: 'videoPublishStateChanged', cb: (
    channel: string,
    oldState: STREAM_PUBLISH_STATE,
    newState: STREAM_PUBLISH_STATE,
    elapseSinceLastState: number
  )=> void): this;
  /** Occurs when the audio subscribing state changes.
   *
   * @since v3.2.0
   *
   * This callback indicates the subscribing state change of a remote audio
   * stream.
   *
   * @param cb.channel The channel name.
   * @param cb.uid The ID of the remote user.
   * @param cb.oldState The previous subscribing state.
   * @param cb.newState The current subscribing state.
   * @param cb.elapseSinceLastState The time elapsed (ms) from the previous state
   * to the current state.
   */
  on(evt: 'audioSubscribeStateChanged', cb: (
    channel: string,
    uid: number,
    oldState: STREAM_SUBSCRIBE_STATE,
    newState: STREAM_SUBSCRIBE_STATE,
    elapseSinceLastState: number
  )=> void): this;
  /** Occurs when the video subscribing state changes.
   *
   * @since v3.2.0
   *
   * This callback indicates the subscribing state change of a remote video
   * stream.
   *
   * @param cb.channel The channel name.
   * @param cb.uid The ID of the remote user.
   * @param cb.oldState The previous subscribing state.
   * @param cb.newState The current subscribing state.
   * @param cb.elapseSinceLastState The time elapsed (ms) from the previous state
   * to the current state.
   */
  on(evt: 'videoSubscribeStateChanged', cb: (
    channel: string,
    uid: number,
    oldState: STREAM_SUBSCRIBE_STATE,
    newState: STREAM_SUBSCRIBE_STATE,
    elapseSinceLastState: number
  )=> void): this;

  on(evt: string, listener: Function): this;
}

/**
 * @since v3.0.0
 *
 * The AgoraRtcChannel class.
 */
class AgoraRtcChannel extends EventEmitter
{
  rtcChannel: NodeRtcChannel;
  constructor(rtcChannel:NodeRtcChannel) {
    super();
    this.rtcChannel = rtcChannel;
    this.initEventHandler();
  }

  /**
   * init event handler
   * @private
   * @ignore
   */
  initEventHandler(): void {
    const fire = (event: string, ...args: Array<any>) => {
      setImmediate(() => {
        this.emit(event, ...args);
      });
    };

    this.rtcChannel.onEvent('apierror', (funcName: string) => {
      console.error(`api ${funcName} failed. this is an error
              thrown by c++ addon layer. it often means sth is
              going wrong with this function call and it refused
              to do what is asked. kindly check your parameter types
              to see if it matches properly.`);
    });

    this.rtcChannel.onEvent('joinChannelSuccess', (
      uid: number,
      elapsed: number
    ) => {
      fire('joinChannelSuccess', uid, elapsed);
    });

    this.rtcChannel.onEvent('channelWarning', (
      warn: number,
      message: string
    ) => {
      fire('channelWarning', warn, message);
    });

    this.rtcChannel.onEvent('channelError', (
      error: number,
      message: string
    ) => {
      fire('channelError', error, message);
    });


    this.rtcChannel.onEvent('rejoinChannelSuccess', (
      uid: number,
      elapsed: number
    ) => {
      fire('rejoinChannelSuccess', uid, elapsed);
    });


    this.rtcChannel.onEvent('leaveChannel', (
      stats: RtcStats
    ) => {
      fire('leaveChannel', stats);
    });

    this.rtcChannel.onEvent('clientRoleChanged', (
      oldRole: number,
      newRole: number
    ) => {
      fire('clientRoleChanged', oldRole, newRole);
    });

    this.rtcChannel.onEvent('userJoined', (
      uid: number,
      elapsed: number
    ) => {
      fire('userJoined', uid, elapsed);
    });

    this.rtcChannel.onEvent('userOffline', (
      uid: number,
      reason: number
    ) => {
      fire('userOffline', uid, reason);
    });

    this.rtcChannel.onEvent('connectionLost', (
    ) => {
      fire('connectionLost');
    });

    this.rtcChannel.onEvent('requestToken', (
    ) => {
      fire('requestToken');
    });

    this.rtcChannel.onEvent('tokenPrivilegeWillExpire', (
      token: string
    ) => {
      fire('tokenPrivilegeWillExpire', token);
    });

    this.rtcChannel.onEvent('rtcStats', (
      stats: RtcStats
    ) => {
      fire('rtcStats', stats);
    });

    this.rtcChannel.onEvent('networkQuality', (
      uid: number,
      txQuality: number,
      rxQuality: number
    ) => {
      fire('networkQuality', uid, txQuality, rxQuality);
    });

    this.rtcChannel.onEvent('remoteVideoStats', (
      stats: RemoteVideoStats
    ) => {
      fire('remoteVideoStats', stats);
    });

    this.rtcChannel.onEvent('remoteAudioStats', (
      stats: RemoteAudioStats
    ) => {
      fire('remoteAudioStats', stats);
    });

    this.rtcChannel.onEvent('remoteAudioStateChanged', (
      uid: number,
      state: RemoteAudioState,
      reason: RemoteAudioStateReason,
      elapsed: number
    ) => {
      fire('remoteAudioStateChanged', uid, state, reason, elapsed);
    });

    this.rtcChannel.onEvent('activeSpeaker', (
      uid: number
    ) => {
      fire('activeSpeaker', uid);
    });

    this.rtcChannel.onEvent('firstRemoteVideoFrame', (
      uid: number,
      width: number,
      height: number,
      elapsed: number
    ) => {
      fire('firstRemoteVideoFrame', uid, width, height, elapsed);
    });

    this.rtcChannel.onEvent('firstRemoteAudioDecoded', (
      uid: number,
      elapsed: number
    ) => {
      fire('firstRemoteAudioDecoded', uid, elapsed);
    });

    this.rtcChannel.onEvent('videoSizeChanged', (
      uid: number,
      width: number,
      height: number,
      rotation: number
    ) => {
      fire('videoSizeChanged', uid, width, height, rotation);
    });

    this.rtcChannel.onEvent('remoteVideoStateChanged', (
      uid: number,
      state: number,
      reason: number,
      elapsed: number
    ) => {
      fire('remoteVideoStateChanged', uid, state, reason, elapsed);
    });

    this.rtcChannel.onEvent('streamMessage', (
      uid: number,
      streamId: number,
      data: string
    ) => {
      fire('streamMessage', uid, streamId, data);
    });

    this.rtcChannel.onEvent('streamMessageError', (
      uid: number,
      streamId: number,
      code: number,
      missed: number,
      cached: number
    ) => {
      fire('streamMessage', uid, streamId, code, missed, cached);
    });

    this.rtcChannel.onEvent('channelMediaRelayStateChanged', (
      state: number,
      code: number
    ) => {
      fire('channelMediaRelayStateChanged', state, code);
    });

    this.rtcChannel.onEvent('channelMediaRelayEvent', (
      code: number
    ) => {
      fire('channelMediaRelayEvent', code);
    });

    this.rtcChannel.onEvent('firstRemoteAudioFrame', (
      uid: number,
      elapsed: number
    ) => {
      fire('firstRemoteAudioFrame', uid, elapsed);
    });

    this.rtcChannel.onEvent('rtmpStreamingStateChanged', (
      url: string,
      state: number,
      errCode: number
    ) => {
      fire('rtmpStreamingStateChanged', url, state, errCode);
    });

    this.rtcChannel.onEvent('transcodingUpdated', (
    ) => {
      fire('transcodingUpdated');
    });

    this.rtcChannel.onEvent('streamInjectedStatus', (
      url: string,
      uid: number,
      status: number
    ) => {
        fire('streamInjectedStatus', url, uid, status);
    });

    this.rtcChannel.onEvent('remoteSubscribeFallbackToAudioOnly', (
      uid: number,
      isFallbackOrRecover: boolean
    ) => {
        fire('remoteSubscribeFallbackToAudioOnly', uid, isFallbackOrRecover);
    });

    this.rtcChannel.onEvent('connectionStateChanged', (
      state: number,
      reason: number
    ) => {
        fire('connectionStateChanged', state, reason);
    });

    this.rtcChannel.onEvent('audioPublishStateChanged', function(oldState: STREAM_PUBLISH_STATE, newState: STREAM_PUBLISH_STATE, elapseSinceLastState: number) {
      fire('audioPublishStateChanged', oldState, newState, elapseSinceLastState);
    })

    this.rtcChannel.onEvent('videoPublishStateChanged', function(oldState: STREAM_PUBLISH_STATE, newState: STREAM_PUBLISH_STATE, elapseSinceLastState: number) {
      fire('videoPublishStateChanged', oldState, newState, elapseSinceLastState);
    })

    this.rtcChannel.onEvent('audioSubscribeStateChanged', function(uid: number, oldState: STREAM_SUBSCRIBE_STATE, newState: STREAM_SUBSCRIBE_STATE, elapseSinceLastState: number) {
      fire('audioSubscribeStateChanged', uid, oldState, newState, elapseSinceLastState);
    })

    this.rtcChannel.onEvent('videoSubscribeStateChanged', function(uid: number, oldState: STREAM_SUBSCRIBE_STATE, newState: STREAM_SUBSCRIBE_STATE, elapseSinceLastState: number) {
      fire('videoSubscribeStateChanged', uid, oldState, newState, elapseSinceLastState);
    })
  }
  /**
   * Joins the channel with a user ID.
   *
   * This method differs from the `joinChannel` method in the `AgoraRtcEngine`
   * class in the following aspects:
   * - For the `joinChannel` method in the `AgoraRtcChannel` class:
   *  - Does not contain the `channel` parameter, because `channel` is
   * specified when creating the `AgoraRtcChannel` object.
   *  - Contains the `options` parameter, which decides whether to subscribe
   * to all streams before joining the channel.
   *  - Users can join multiple channels simultaneously by creating multiple
   * `AgoraRtcChannel` objects and calling the `joinChannel` method of each
   * object.
   *  - By default, the SDK does not publish any stream after the user joins
   * the channel. You need to call the {@link publish} method to do that.
   * - For the `joinChannel` method in the `AgoraRtcEngine` class:
   *  - Contains the `channel` parameter, which specifies the channel to join.
   *  - Does not contain the `options` parameter. By default, users subscribe
   * to all streams when joining the channel.
   *  - Users can join only one channel.
   *  - By default, the SDK publishes streams once the user joins the channel.
   * @note
   * - If you are already in a channel, you cannot rejoin it with the same `uid`.
   * - We recommend using different UIDs for different channels.
   * - If you want to join the same channel from different devices, ensure
   * that the UIDs in all devices are different.
   * - Ensure that the app ID you use to generate the token is the same with
   * the app ID used when creating the `AgoraRtcChannel` object.
   * @param token The token for authentication:
   * - In situations not requiring high security: You can use the temporary
   * token generated at Console. For details, see
   * [Get a temporary token](https://docs.agora.io/en/Agora%20Platform/token?platfor%20*%20m=All%20Platforms#get-a-temporary-token).
   * - In situations requiring high security: Set it as the token generated at
   * your server. For details, see
   * [Generate a token](https://docs.agora.io/en/Agora%20Platform/token?platfor%20*%20m=All%20Platforms#get-a-token).
   * @param info (Optional) Additional information about the channel. This parameter can be set as null. Other users in the channel do not receive this information.
   * @param uid The user ID. A 32-bit unsigned integer with a value ranging
   * from 1 to (232-1). This parameter must be unique. If `uid` is not
   * assigned (or set as `0`), the SDK assigns a `uid` and reports it in
   * the `joinChannelSuccess` callback.
   * The app must maintain this user ID.
   * @param options The channel media options, see
   * {@link ChannelMediaOptions}
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *  - `ERR_INVALID_ARGUMENT (2)`
   *  - `ERR_NOT_READY (3)`
   *  - `ERR_REFUSED (5)`
   */
  joinChannel(
    token: string,
    info: string,
    uid: number,
    options: ChannelMediaOptions
  ): number {
    return this.rtcChannel.joinChannel(token, info, uid, options || {
      autoSubscribeAudio: true,
      autoSubscribeVideo: true
    });
  }
  /**
   * Joins the channel with a user account.
   *
   * After the user successfully joins the channel, the SDK triggers the
   * following callbacks:
   * - The local client: `localUserRegistered` and `joinChannelSuccess`.
   * - The remote client: `userJoined` and `userInfoUpdated`, if the user
   * joining the channel is in the communication(`0`) profile, or is a host
   * in the `1` (live streaming) profile.
   *
   * @note To ensure smooth communication, use the same parameter type to
   * identify the user. For example, if a user joins the channel with a user
   * ID, then ensure all the other users use the user ID too. The same applies
   * to the user account. If a user joins the channel with the Agora Web SDK,
   * ensure that the uid of the user is set to the same parameter type.
   * @param token The token generated at your server:
   * - In situations not requiring high security: You can use the temporary
   * token generated at Console. For details, see
   * [Get a temporary token](https://docs.agora.io/en/Agora%20Platform/token?platfor%20*%20m=All%20Platforms#get-a-temporary-token).
   * - In situations requiring high security: Set it as the token generated at
   * your server. For details, see
   * [Generate a token](https://docs.agora.io/en/Agora%20Platform/token?platfor%20*%20m=All%20Platforms#get-a-token).
   * @param userAccount The user account. The maximum length of this parameter
   * is 255 bytes. Ensure that you set this parameter and do not set it as
   * null. Supported character scopes are:
   * - All lowercase English letters: a to z.
   * - All uppercase English letters: A to Z.
   * - All numeric characters: 0 to 9.
   * - The space character.
   * - Punctuation characters and other symbols, including: "!", "#", "$",
   * "%", "&", "(", ")", "+", "-", ":", ";", "<", "=", ".", ">", "?", "@",
   * "[", "]", "^", "_", " {", "}", "|", "~", ",".
   * @param options The channel media options, see
   * {@link ChannelMediaOptions}
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *  - `ERR_INVALID_ARGUMENT (2)`
   *  - `ERR_NOT_READY (3)`
   *  - `ERR_REFUSED (5)`
   */
  joinChannelWithUserAccount(
    token: string,
    userAccount: string,
    options: ChannelMediaOptions
  ): number {
    return this.rtcChannel.joinChannelWithUserAccount(token, userAccount, options || {
      autoSubscribeAudio: true,
      autoSubscribeVideo: true
    });
  }
  /**
   * Gets the channel ID of the current `AgoraRtcChannel` object.
   *
   * @return
   * - The channel ID of the current `AgoraRtcChannel` object, if the method
   * call succeeds.
   * - The empty string "", if the method call fails.
   */
  channelId(): string {
    return this.rtcChannel.channelId()
  }
  /**
   * Retrieves the current call ID.
   *
   * When a user joins a channel on a client, a `callId` is generated to
   * identify the call from the client. Feedback methods, such as
   * {@link AgoraRtcChannel.rate rate} and
   * {@link AgoraRtcChannel.complain complain}, must be called after the call
   * ends to submit feedback to the SDK.
   *
   * The `rate` and `complain` methods require the `callId` parameter retrieved
   * from the `getCallId` method during a call.
   *
   * @return
   * - The call ID, if the method call succeeds.
   * - The empty string "", if the method call fails.
   */
  getCallId(): string {
    return this.rtcChannel.getCallId()
  }
  /**
   * Sets the role of the user.
   *
   * - This method can be used to set the user's role before the user joins a
   * channel in a live streaming.
   * - This method can be used to switch the user role in a live streaming after
   * the user joins a channel.
   *
   * In the `1` (live streaming) profile, when a user calls this method to switch
   * user roles after joining a channel, SDK triggers the follwoing callbacks:
   * - The local client: `clientRoleChanged` in the `AgoraRtcChannel`
   * interface.
   * - The remote clinet: `userjoined` or `userOffline`.
   *
   * @note This method applies only to the `1` (live streaming) profile.
   * @param role Sets the role of the user. See
   * {@link AgoraRtcChannel.role role}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setClientRole(role: ClientRoleType): number {
    return this.rtcChannel.setClientRole(role);
  }

  /** Sets the role of a user in interactive live streaming.
   *
   * @since v3.2.0
   *
   * You can call this method either before or after joining the channel to
   * set the user role as audience or host. If
   * you call this method to switch the user role after joining the channel,
   * the SDK triggers the following callbacks:
   * - The local client: `clientRoleChanged`.
   * - The remote client: `userJoined` or `userOffline`.
   *
   * @note
   * - This method applies to the `LIVE_BROADCASTING` profile only.
   * - The difference between this method and {@link setClientRole} is that
   * this method can set the user level in addition to the user role.
   *  - The user role determines the permissions that the SDK grants to a
   * user, such as permission to send local
   * streams, receive remote streams, and push streams to a CDN address.
   *  - The user level determines the level of services that a user can
   * enjoy within the permissions of the user's
   * role. For example, an audience can choose to receive remote streams with
   * low latency or ultra low latency. Levels
   * affect prices.
   *
   * @param role The role of a user in interactive live streaming.
   * @param options The detailed options of a user, including user level.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setClientRoleWithOptions(role: ClientRoleType, options: ClientRoleOptions): number {
    return this.rtcChannel.setClientRoleWithOptions(role, options);
  }
  /**
   * Prioritizes a remote user's stream.
   *
   * Use this method with the
   * {@link setRemoteSubscribeFallbackOption} method.
   *
   * If the fallback function is enabled for a subscribed stream, the SDK
   * ensures the high-priority user gets the best possible stream quality.
   *
   * @note The Agora SDK supports setting `serPriority` as high for one user
   * only.
   * @param uid The ID of the remote user.
   * @param priority The priority of the remote user. See
   * {@link Priority}.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setRemoteUserPriority(uid: number, priority: Priority) {
    return this.rtcChannel.setRemoteUserPriority(uid, priority);
  }
  /**
   * Gets a new token when the current token expires after a period of time.
   *
   * The `token` expires after a period of time once the token schema is
   * enabled when the SDK triggers the `onTokenPrivilegeWillExpire` callback or
   * `CONNECTION_CHANGED_TOKEN_EXPIRED(9)` of `onConnectionStateChanged`
   * callback.
   *
   * You should call this method to renew `token`, or the SDK disconnects from
   * Agora' server.
   *
   * @param newtoken The new Token.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  renewToken(newtoken: string): number {
    return this.rtcChannel.renewToken(newtoken);
  }
  /**
   * @deprecated This method is deprecated from v3.2.0. Use the
   * {@link enableEncryption} method instead.
   *
   * Enables built-in encryption with an encryption password before users
   * join a channel.
   *
   * All users in a channel must use the same encryption password. The
   * encryption password is automatically cleared once a user leaves the
   * channel. If an encryption password is not specified, the encryption
   * functionality will be disabled.
   *
   * @note
   * - Do not use this method for the CDN live streaming function.
   * - For optimal transmission, ensure that the encrypted data size does not
   * exceed the original data size + 16 bytes. 16 bytes is the maximum padding
   * size for AES encryption.
   *
   * @param secret The encryption password.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setEncryptionSecret(secret: string): number {
    return this.rtcChannel.setEncryptionSecret(secret);
  }
  /**
   * Sets the built-in encryption mode.
   *
   * @depercated This method is deprecated from v3.2.0. Use
   * the {@link enableEncryption} method instead.
   *
   * The Agora SDK supports built-in encryption, which is set to the
   * `aes-128-xts` mode by default. To use other encryption modes, call this
   * method.
   *
   * All users in the same channel must use the same encryption mode and
   * password.
   *
   * Refer to the information related to the AES encryption algorithm on the
   * differences between the encryption modes.
   *
   * @note Call the {@link setEncryptionSecret} method before calling this
   * method.
   *
   * @param mode The set encryption mode:
   * - "aes-128-xts": (Default) 128-bit AES encryption, XTS mode.
   * - "aes-128-ecb": 128-bit AES encryption, ECB mode.
   * - "aes-256-xts": 256-bit AES encryption, XTS mode.
   * - "": When encryptionMode is set as NULL, the encryption mode is set as
   * "aes-128-xts" by default.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setEncryptionMode(mode: string): number {
    return this.rtcChannel.setEncryptionMode(mode);
  }
  /**
   * Sets the sound position and gain of a remote user.
   *
   * When the local user calls this method to set the sound position of a
   * remote user, the sound difference between the left and right channels
   * allows the local user to track the real-time position of the remote user,
   * creating a real sense of space. This method applies to massively
   * multiplayer online games, such as Battle Royale games.
   *
   * @note
   * - For this method to work, enable stereo panning for remote users by
   * calling the {@link enableSoundPositionIndication} method before joining a
   * channel.
   * - This method requires hardware support. For the best sound positioning,
   * we recommend using a stereo speaker.
   * @param uid The ID of the remote user.
   * @param pan The sound position of the remote user. The value ranges from
   * -1.0 to 1.0:
   * - 0.0: The remote sound comes from the front.
   * - -1.0: The remote sound comes from the left.
   * - 1.0: The remote sound comes from the right.
   * @param gain Gain of the remote user. The value ranges from 0.0 to 100.0.
   * The default value is 100.0 (the original gain of the remote user). The
   * smaller the value, the less the gain.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setRemoteVoicePosition(uid: number, pan: number, gain: number): number {
    return this.rtcChannel.setRemoteVoicePosition(uid, pan, gain);
  }
  /**
   * Sets whether to receive all remote audio streams by default.
   *
   * You can call this method either before or after joining a channel. If you
   * call `setDefaultMuteAllRemoteAudioStreams(true)` after joining a channel,
   * you will not receive the audio streams of any subsequent user.
   *
   * @note If you want to resume receiving the audio stream, call
   * {@link muteRemoteAudioStream}(false), and specify the ID of the remote
   * user whose audio stream you want to receive. To resume receiving
   * the audio streams
   * of multiple remote users, call {@link muteRemoteAudioStream}(false) as
   * many times. Calling `setDefaultMuteAllRemoteAudioStreams(false)` resumes
   * receiving the audio streams of subsequent users only.
   *
   * @param mute Sets whether to receive/stop receiving all remote users'
   * audio streams by default:
   * - true:  Stop receiving all remote users' audio streams by default.
   * - false: (Default) Receive all remote users' audio streams by default.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setDefaultMuteAllRemoteAudioStreams(mute: boolean): number {
    return this.rtcChannel.setDefaultMuteAllRemoteAudioStreams(mute);
  }
  /**
   * Sets whether to receive all remote video streams by default.
   *
   * You can call this method either before or after joining a channel. If you
   * call `setDefaultMuteAllRemoteVideoStreams(true)` after joining a channel,
   * you will not receive the video stream of any subsequent user.
   *
   * @note If you want to resume receiving the video stream, call
   * {@link muteRemoteVideoStream}(false), and specify the ID of the remote
   * user whose audio stream you want to receive. To resume receiving
   * the audio streams
   * of multiple remote users, call {@link muteRemoteVideoStream}(false) as
   * many times. Calling `setDefaultMuteAllRemoteVideoStreams(false)` resumes
   * receiving the audio streams of subsequent users only.
   * @param mute Sets whether to receive/stop receiving all remote users' video
   * streams by default:
   * - true: Stop receiving all remote users' video streams by default.
   * - false: (Default) Receive all remote users' video streams by default.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setDefaultMuteAllRemoteVideoStreams(mute: boolean): number {
    return this.rtcChannel.setDefaultMuteAllRemoteVideoStreams(mute);
  }
  /**
   * Stops/Resumes receiving all remote users' audio streams.
   *
   * @param mute Sets whether to receive/stop receiving all remote users'
   * audio streams.
   * - true: Stop receiving all remote users' audio streams.
   * - false: (Default) Receive all remote users' audio streams.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  muteAllRemoteAudioStreams(mute: boolean): number {
    return this.rtcChannel.muteAllRemoteAudioStreams(mute);
  }
  /**
   * Stops/Resumes receiving a specified remote user's audio stream.
   *
   * If you called the {@link muteAllRemoteAudioStreams}(true) method to stop
   * receiving all remote users' audio streams, please call
   * the `muteAllRemoteAudioStreams`(false) method before calling the
   * `muteRemoteAudioStream` method.
   *
   * The `muteAllRemoteAudioStreams` method sets all remote audio streams,
   * while the `muteRemoteAudioStream` method sets a specified remote audio
   * stream.
   * @param uid The user ID of the specified remote user sending the audio.
   * @param mute Sets whether to receive/stop receiving a specified remote
   * user's audio stream:
   * - true: Stop receiving the specified remote user's audio stream.
   * - false: (Default) Receive the specified remote user's audio stream.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  muteRemoteAudioStream(uid: number, mute: boolean): number {
    return this.rtcChannel.muteRemoteAudioStream(uid, mute);
  }
  /**
   * Stops/Resumes receiving all video stream from a specified remote user.
   *
   * @param mute Sets whether to receive/stop receiving all remote users'
   * video streams:
   * - true: Stop receiving all remote users' video streams.
   * - false: (Default) Receive all remote users' video streams.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  muteAllRemoteVideoStreams(mute: boolean): number {
    return this.rtcChannel.muteAllRemoteVideoStreams(mute);
  }
  /**
   * Stops/Resumes receiving the video stream from a specified remote user.
   *
   * It you called the {@link muteAllRemoteVideoStreams}(true) to stop
   * receiving all remote video streams, please call the
   * `muteAllRemoteVideoStreams`(false) before calling `muteRemoteVideoStream`
   * method.
   * @param uid The user ID of the specified remote user.
   * @param mute Sets whether to stop/resume receiving the video stream from a
   * specified remote user:
   * - true: Stop receiving the specified remote user's video stream.
   * - false: (Default) Receive the specified remote user's video stream.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  muteRemoteVideoStream(uid: number, mute: boolean): number {
    return this.rtcChannel.muteRemoteVideoStream(uid, mute);
  }
  /**
   * Sets the stream type of the remote video.
   *
   * Under limited network conditions, if the publisher has not disabled the
   * dual-stream mode using {@link enableDualStreamMode}(`false`), the receiver
   * can choose to receive either the high-video stream (the high resolution,
   * and high bitrate video stream) or the low-video stream (the low
   * resolution, and low bitrate video stream).
   *
   * By default, users receive the high-video stream. Call this method if you
   * want to switch to the low-video stream. This method allows the app to
   * adjust the corresponding video stream type based on the size of the video
   * window to reduce the bandwidth and resources.
   *
   * The aspect ratio of the low-video stream is the same as the high-video
   * stream. Once the resolution of the high-video stream is set, the system
   * automatically sets the resolution, frame rate, and bitrate of the
   * low-video stream.
   * The SDK reports the result of calling this method in the
   * `apiCallExecuted` callback.
   *
   * @param uid The ID of the remote user sending the video stream.
   * @param streamType The video-stream type. See {@link StreamType}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setRemoteVideoStreamType(uid: number, streamType: StreamType): number {
    return this.rtcChannel.setRemoteVideoStreamType(uid, streamType);
  }
  /**
   * Sets the default type of receiving video stream.
   *
   * Under limited network conditions, if the publisher has not disabled the
   * dual-stream mode using {@link enableDualStreamMode}(false), the receiver
   * can choose to receive either the high-video stream (the high resolution,
   * and high bitrate video stream) or the low-video stream (the low
   * resolution, and low bitrate video stream) by default.
   *
   * By default, users receive the high-video stream. Call this method if you
   * want to switch to the low-video stream. This method allows the app to
   * adjust the corresponding video stream type based on the size of the video
   * window to reduce the bandwidth and resources.
   *
   * The aspect ratio of the low-video stream is the same as the high-video
   * stream. Once the resolution of the high-video stream is set, the system
   * automatically sets the resolution, frame rate, and bitrate of the
   * low-video stream.
   *
   * @param streamType The video-stream type. See {@link StreamType}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setRemoteDefaultVideoStreamType(streamType: StreamType): number {
    return this.rtcChannel.setRemoteDefaultVideoStreamType(streamType);
  }
  /**
   * Creates a data stream.
   *
   * Each user can create up to five data streams during the lifecycle of the
   * AgoraRtcChannel.
   *
   * @note Set both the `reliable` and `ordered` parameters to `true` or
   * `false`. Do not set one as `true` and the other as `false`.
   *
   * @param reliable Sets whether or not the recipients are guaranteed to
   * receive the data stream from the sender within five seconds:
   * - true: The recipients receive the data stream from the sender within five
   * seconds. If the recipient does not receive the data stream within five
   * seconds, an error is reported to the application.
   * - false: There is no guarantee that the recipients receive the data stream
   * within five seconds and no error message is reported for any delay or
   * missing data stream.
   * @param ordered Sets whether or not the recipients receive the data stream
   * in the sent order:
   * - true: The recipients receive the data stream in the sent order.
   * - false: The recipients do not receive the data stream in the sent order.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  createDataStream(reliable: boolean, ordered: boolean): number {
    return this.rtcChannel.createDataStream(reliable, ordered);
  }
  /**
   * Sends data stream messages to all users in the channel.
   *
   * The SDK has the following restrictions on this method:
   * - Up to 30 packets can be sent per second in a channel with each packet
   * having a maximum size of 1 kB.
   * - Each client can send up to 6 kB of data per second.
   * - Each user can have up to five data streams simultaneously.
   *
   * Ensure that you have created the data stream using
   * {@link createDataStream} before calling this method.
   *
   * If the method call succeeds, the remote user receives the `streamMessage`
   * callback; If the method call fails, the remote user receives the
   * `streamMessageError` callback.
   *
   * @note This method applies to the users in the communication(`0`) profile or the
   * hosts in the `1` (live streaming) profile. If an audience in the
   * `1` (live streaming) profile calls this method, the role of the audience may be
   * switched to the host.
   *
   * @param streamId he ID of the sent data stream, returned in the
   * {@link createDataStream} method.
   * @param msg The data stream messages.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  sendStreamMessage(streamId: number, msg: string): number {
    return this.rtcChannel.sendStreamMessage(streamId, msg);
  }
  /**
   * Publishes the local stream to a specified CDN URL address.
   *
   * In the `1` (live streaming) profile, the host can call this method to
   * publish the local stream to a specified CDN URL address, which is called
   * "Push Streams to CDN" or "CDN live streaming."
   *
   * During the CDN live streaming, the SDK triggers the
   * `rtmpStreamingStateChanged` callback is any streaming state changes.
   *
   * @note
   * - Only the host in the `1` (live streaming) profile can call this method.
   * - Call this method after the host joins the channel.
   * - Ensure that you enable the RTMP Converter service before using this
   * function. See *Prerequisites* in the *Push Streams to CDN* guide.
   * - This method adds only one stream RTMP URL address each time it is
   * called.
   *
   * @param url The CDN streaming URL in the RTMP format. The maximum length
   * of this parameter is 1024 bytes. The RTMP URL address must not contain
   * special characters, such as Chinese language characters.
   * @param transcodingEnabled Sets whether transcoding is enabled/disabled:
   * - true: Enable transcoding. To
   * [transcode](https://docs.agora.io/en/Agora%20Platform/terms?platform=All%20Platforms#transcoding)
   * the audio or video streams when publishing them to CDN live, often used
   * for combining the audio and video streams of multiple hosts in CDN live.
   * When you set this parameter as `true`, ensure that you call the
   * {@link setLiveTranscoding} method before this method.
   * - false: Disable transcoding.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   *  - `ERR_INVALID_ARGUMENT (2)`: The RTMP URL address is NULL or has a
   * string length of 0.
   *  - `ERR_NOT_INITIALIZED (7)`: You have not initialized `AgoraRtcChannel`
   * when publishing the stream.
   */
  addPublishStreamUrl(url: string, transcodingEnabled: boolean): number {
    return this.rtcChannel.addPublishStreamUrl(url, transcodingEnabled);
  }
  /**
   * Removes the RTMP stream from the CDN.
   *
   * This method removes the RTMP URL address (added by
   * {@link addPublishStreamUrl}) and stops the CDN live streaming.
   *
   * This method call triggers the `rtmpStreamingStateChanged` callback to
   * report the state of removing the URL address.
   *
   * @note
   * - Only the host in the `1` (live streaming) profile can call this
   * method.
   * - This method removes only one RTMP URL address each time it is
   * called.
   * - This method applies to the `1` (live streaming) profile only.
   * - Call this method after {@link addPublishStreamUrl}.
   * @param url The RTMP URL address to be removed. The maximum length of this
   * parameter is 1024 bytes. The RTMP URL address must not contain special
   * characters, such as Chinese language characters.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  removePublishStreamUrl(url: string): number {
    return this.rtcChannel.removePublishStreamUrl(url);
  }
  /**
   * Sets the video layout and audio settings for CDN live.
   *
   * The SDK triggers the `transcodingUpdated` callback when you call this
   * method to **update** the transcoding setting. If you call this method for
   * the first time to **set** the transcoding setting, the SDK does not
   * trigger the `transcodingUpdated` callback.
   *
   * @note
   * - Only the host in the Live-broadcast porfile can call this method.
   * - Ensure that you enable the RTMP Converter service before using
   * this function. See *Prerequisites* in the *Push Streams to CDN* guide.
   * - If you call the {@link setLiveTranscoding} method to set the
   * LiveTranscoding class for the first time, the SDK does not trigger the
   * transcodingUpdated callback.
   * @param transcoding The transcoding setting for the audio and video streams
   * during the CDN live streaming. See {@link LiveTranscoding}
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  setLiveTranscoding(transcoding: TranscodingConfig): number {
    return this.rtcChannel.setLiveTranscoding(transcoding);
  }
  /**
   * Injects the online media stream to a live streaming.
   *
   * If this method call is successful, the server pulls the voice or video
   * stream and injects it into a live channel. And all audience members in the
   * channel can watch a live show and interact with each other.
   *
   * This method call triggers the following callbacks:
   * - The local client:
   *  - `streamInjectedStatus`, reports the injecting status.
   *  - `userJoined`(uid:666), reports the stream is injected successfully and
   * the UID of this stream is 666.
   * - The remote client:
   *  - `userJoined`(uid:666), reports the stream is injected successfully and
   * the UID of this stream is 666.
   *
   * @note
   * - Only the host in the `1` (live streaming) profile can call this method.
   * - Ensure that you enable the RTMP Converter service before using this
   * function. See *Prerequisites* in the *Push Streams to CDN* guide.
   * - This method applies to the `1` (live streaming) profile only.
   * - You can inject only one media stream into the channel at the same time.
   *
   * @param url The URL address to be added to the ongoing live streaming.
   * Valid protocols are RTMP, HLS, and HTTP-FLV.
   * - Supported audio codec type: AAC.
   * - Supported video codec type: H264 (AVC).
   * @param config The configuration of the injected stream.
   * See InjectStreamConfig
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   *  - ERR_INVALID_ARGUMENT (2): The injected URL does not exist. Call this
   * method again to inject the stream and ensure that the URL is valid.
   *  - ERR_NOT_READY (3): The user is not in the channel.
   *  - ERR_NOT_SUPPORTED (4): The channel profile is not live streaming.
   * Call the {@link setChannelProfile} method and set the channel profile to
   * live streaming before calling this method.
   *  - ERR_NOT_INITIALIZED (7): The SDK is not initialized. Ensure that the
   * `AgoraRtcChannel` object is initialized before calling this method.
   */
  addInjectStreamUrl(url: string, config: InjectStreamConfig): number {
    return this.rtcChannel.addInjectStreamUrl(url, config);
  }
  /**
   * Removes the injected the online media stream in a live streaming.
   *
   * This method removes the URL address (added by the
   * {@link addInjectStreamUrl} method) in a live streaming.
   *
   * If this method call is successful, the SDK triggers the `userOffline`
   * (uid:666) callback and report the UID of the removed stream is 666.
   *
   * @param url The URL address of the injected stream to be removed.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  removeInjectStreamUrl(url: string): number {
    return this.rtcChannel.removeInjectStreamUrl(url);
  }
  /**
   * Starts to relay media streams across channels.
   *
   * After a successful method call, the SDK triggers the
   * `channelMediaRelayState` and `channelMediaRelayEvent` callbacks, which
   * returns the state and event of the media stream relay.
   *
   * - If `channelMediaRelayState` returns the state code `2` and the error
   * code` 0`, and `channelMediaRelayEvent` returns the event code `4`, the
   * host starts sending data to the destination channel.
   * - If the `channelMediaRelayState` returns the state code `3`, an exception
   * occurs during the media stream relay.
   *
   * @note
   * - Contact sales-us@agora.io before implementing this function.
   * - Call this method after joining the channel.
   * - This method takes effect only when you are a host in a
   * live-broadcast channel.
   * - After a successful method call, if you want to call this method again,
   * ensure that you call the {@link stopChannelMediaRelay} method to quit the
   * current relay.
   * - We do not support string user accounts in this API.
   *
   * @param config The configuration of the media stream relay. See
   * ChannelMediaRelayConfiguration
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  startChannelMediaRelay(config: ChannelMediaRelayConfiguration): number {
    return this.rtcChannel.startChannelMediaRelay(config);
  }
  /**
   * Updates the channels for media stream relay.
   *
   * After a successful {@link startChannelMediaRelay} method call, if you want
   * to relay the media stream to more channels, or leave the current relay
   * channel, you can call the `updateChannelMediaRelay` method.
   *
   * After a successful method call, the SDK triggers the
   * `channelMediaRelayEvent` callback with the event code `7`.
   *
   * @note Call this method after the {@link startChannelMediaRelay} method to
   * update the destination channel.
   * @param config The configuration of the media stream relay. See
   * ChannelMediaRelayConfiguration
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  updateChannelMediaRelay(config: ChannelMediaRelayConfiguration): number {
    return this.rtcChannel.updateChannelMediaRelay(config);
  }
  /**
   * Stops the media stream relay.
   *
   * Once the relay stops, the host quits all the destination channels.
   *
   * After a successful method call, the SDK triggers the
   * `channelMediaRelayState` callback. If the callback returns the state code
   * `0` and the error code `1`, the host successfully stops the relay.
   *
   * @note If the method call fails, the SDK triggers the
   * channelMediaRelayState callback with the error code `2` and `8` in
   * {@link ChannelMediaRelayError}. You can leave the channel by calling
   * the {@link leaveChannel} method, and
   * the media stream relay automatically stops.
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   */
  stopChannelMediaRelay(): number {
    return this.rtcChannel.stopChannelMediaRelay();
  }
  /**
   * Gets the connection state of the SDK.
   * @return {ConnectionState} Connect states. See {@link ConnectionState}.
   */
  getConnectionState(): ConnectionState {
    return this.rtcChannel.getConnectionState();
  }
  /**
   * Publishes the local stream to the channel.
   *
   * You must keep the following restrictions in mind when calling this method.
   * Otherwise, the SDK returns the `ERR_REFUSED (5)`:
   * - This method publishes one stream only to the channel corresponding to
   * the current `AgoraRtcChannel` object.
   * - In a live streaming channel, only a host can call this method.
   * To switch the client role, call {@link setClientRole} of the current
   * `AgoraRtcChannel` object.
   * - You can publish a stream to only one channel at a time. For details on
   * joining multiple channels, see the advanced guide *Join Multiple Channels*
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   *  - ERR_REFUSED (5): The method call is refused.
   */
  publish(): number {
    return this.rtcChannel.publish()
  }
  /**
   * Stops publishing a stream to the channel.
   *
   * If you call this method in a channel where you are not publishing streams,
   * the SDK returns #ERR_REFUSED (5).
   *
   * @return
   * - 0: Success
   * - < 0: Failure
   *  - ERR_REFUSED (5): The method call is refused.
   */
  unpublish(): number {
    return this.rtcChannel.unpublish()
  }
  /**
   * Allows a user to leave a channel.
   *
   * Allows a user to leave a channel, such as hanging up or exiting a call.
   * The user must call the method to end the call before
   * joining another channel after call the {@link joinChannel} method.
   * This method returns 0 if the user leaves the channel and releases all
   * resources related to the call.
   * This method call is asynchronous, and the user has not left the channel
   * when the method call returns.
   *
   * Once the user leaves the channel, the SDK triggers the leavechannel
   * callback.
   *
   * A successful leavechannel method call triggers the removeStream callback
   * for the remote client when the user leaving the channel
   * is in the Communication channel, or is a host in the Live streaming
   * profile.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  leaveChannel(): number {
    return this.rtcChannel.leaveChannel()
  }
  /**
   * Releases all AgoraRtcChannel resource
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   *  - `ERR_NOT_INITIALIZED (7)`: The SDK is not initialized before calling
   * this method.
   */
  release(): number {
    return this.rtcChannel.release()
  }

  /**
   * Adjusts the playback volume of a specified remote user.
   *
   * You can call this method as many times as necessary to adjust the playback
   * volume of different remote users, or to repeatedly adjust the playback
   * volume of the same remote user.
   *
   * @note
   * - Call this method after joining a channel.
   * - The playback volume here refers to the mixed volume of a specified
   * remote user.
   * - This method can only adjust the playback volume of one specified remote
   * user at a time. To adjust the playback volume of different remote users,
   * call the method as many times, once for each remote user.
   *
   * @param uid The ID of the remote user.
   * @param volume The playback volume of the specified remote user. The value
   * ranges from 0 to 100:
   * - 0: Mute.
   * - 100: Original volume.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  adjustUserPlaybackSignalVolume(uid: number, volume: number): number {
    return this.rtcChannel.adjustUserPlaybackSignalVolume(uid, volume);
  }
  /** Unregisters a media metadata observer.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  unRegisterMediaMetadataObserver(): number {
    return this.rtcChannel.unRegisterMediaMetadataObserver();
  }
  /** Registers a media metadata observer.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  registerMediaMetadataObserver(): number {
    const fire = (event: string, ...args: Array<any>) => {
      setImmediate(() => {
        this.emit(event, ...args);
      });
    };

    this.rtcChannel.addMetadataEventHandler((metadata: Metadata) => {
      fire('receiveMetadata', metadata);
    }, (metadata: Metadata) => {
      fire('sendMetadataSuccess', metadata);
    });
    return this.rtcChannel.registerMediaMetadataObserver();
  }
  /** Sends the media metadata.
   *
   * After calling the {@link registerMediaMetadataObserver} method, you can
   * call the `setMetadata` method to send the media metadata.
   *
   * If it is a successful sending, the sender receives the
   * `sendMetadataSuccess` callback, and the receiver receives the
   * `receiveMetadata` callback.
   *
   * @param metadata The media metadata.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  sendMetadata(metadata: Metadata): number {
    return this.rtcChannel.sendMetadata(metadata);
  }
  /** Sets the maximum size of the media metadata.
   *
   * After calling the {@link registerMediaMetadataObserver} method, you can
   * call the `setMaxMetadataSize` method to set the maximum size.
   *
   * @param size The maximum size of your metadata.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  setMaxMetadataSize(size: number): number {
    return this.rtcChannel.setMaxMetadataSize(size);
  }
  /** Enables/Disables the built-in encryption.
   *
   * @since v3.2.0
   *
   * In scenarios requiring high security, Agora recommends calling this
   * method to enable the built-in encryption before joining a channel.
   *
   * All users in the same channel must use the same encryption mode and
   * encryption key. Once all users leave the channel, the encryption key
   * of this channel is automatically cleared.
   *
   * @note
   * - If you enable the built-in encryption, you cannot use the RTMP
   * or RTMPS streaming function.
   * - The SDK returns `-4` when the encryption mode is incorrect or the SDK
   * fails to load the external encryption library. Check the enumeration or
   * reload the external encryption library.
   *
   * @param enabled Whether to enable the built-in encryption:
   * - true: Enable the built-in encryption.
   * - false: Disable the built-in encryption.
   * @param config Configurations of built-in encryption schemas.
   *
   * @return
   * - 0: Success.
   * - < 0: Failure.
   */
  enableEncryption(enabled: boolean, config: EncryptionConfig): number {
    return this.rtcChannel.enableEncryption(enabled, config);
  }
}



declare interface AgoraRtcChannel {
  /** Occurs when a user joins a specified channel.
   * @param cb.uid The User ID.
   * @param cb.elapsed Time elapsed (ms) from the user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
  on(evt: 'joinChannelSuccess', cb: (uid: number, elapsed: number) => void): this;
  /**
   * Reports a warning during SDK runtime.
   * @param cb.warn Warning code.
   * @param cb.msg The warning message.
   */
  on(evt: 'channelWarning', cb: (warn: number, msg: string) => void): this;
  /** Reports an error during SDK runtime.
   * @param cb.err Error code.
   * @param cb.msg The error message.
   */
  on(evt: 'channelError', cb: (err: number, msg: string) => void): this;
  /** Occurs when a user rejoins the channel after disconnection due to network
   * problems.
   * When a user loses connection with the server because of network problems,
   * the SDK automatically tries to reconnect and triggers this callback upon
   * reconnection.
   * @param cb.uid User ID of the user joining the channel.
   * @param cb.elapsed Time elapsed (ms) from the user calling the
   * {@link joinChannel}
   * method until the SDK triggers this callback.
   */
  on(
    evt: 'rejoinChannelSuccess',
    cb: (uid: number, elapsed: number) => void
  ): this;
  /** Occurs when the user leaves the channel.
   *
   * When the app calls the
   * {@link leaveChannel} method, the SDK uses
   * this callback to notify the app when the user leaves the channel.
   *
   * @param cb.stats The call statistics, see {@link RtcStats}
   */
  on(evt: 'leaveChannel', cb: (stats:RtcStats) => void): this;
  /** Occurs when the user role switches in a live streaming.
   *
   * For example,
   * from a host to an audience or vice versa.
   *
   * This callback notifies the application of a user role switch when the
   * application calls the {@link setClientRole} method.
   *
   * @param cb.oldRole The old role, see {@link ClientRoleType}
   * @param cb.newRole The new role, see {@link ClientRoleType}
   */
   on(
    evt: 'clientRoleChanged',
    cb: (oldRole: ClientRoleType, newRole: ClientRoleType) => void
  ): this;
  /** Occurs when a user or host joins the channel.
   *
   * The SDK triggers this callback under one of the following circumstances:
   * - A remote user/host joins the channel by calling the {@link joinChannel}
   * method.
   * - A remote user switches the user role to the host by calling the
   * {@link setClientRole} method after joining the channel.
   * - A remote user/host rejoins the channel after a network interruption.
   * - The host injects an online media stream into the channel by calling
   * the {@link addInjectStreamUrl} method.
   *
   * @note In the `1` (live streaming) profile:
   * - The host receives this callback when another host joins the channel.
   * - The audience in the channel receives this callback when a new host
   * joins the channel.
   * - When a web application joins the channel, the SDK triggers this
   * callback as long as the web application publishes streams.
   *
   * @param cb.uid User ID of the user or host joining the channel.
   * @param cb.elapsed Time delay (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
   on(evt: 'userJoined', cb: (uid: number, elapsed: number) => void): this;
   /** Occurs when a remote user (Communication)/host (Live streaming) leaves
   * the channel.
   *
   * There are two reasons for users to become offline:
   * - Leave the channel: When the user/host leaves the channel, the user/host
   * sends a goodbye message. When this message is received, the SDK determines
   * that the user/host leaves the channel.
   * - Drop offline: When no data packet of the user or host is received for a
   * certain period of time, the SDK assumes that the user/host drops
   * offline. A poor network connection may lead to false detections, so we
   * recommend using the signaling system for reliable offline detection.
   *
   * @param cb.uid ID of the user or host who leaves the channel or goes
   * offline.
   * @param cb.reason Reason why the user goes offline:
   *  - The user left the current channel.
   *  - The SDK timed out and the user dropped offline because no data packet
   * was received within a certain period of time. If a user quits the call
   * and the message is not passed to the SDK (due to an unreliable channel),
   * the SDK assumes the user dropped offline.
   *  - (Live streaming only.) The client role switched from the host to the
   * audience.
   */
   on(evt: 'userOffline', cb: (uid: number, reason: number) => void): this;
  /** Occurs when the SDK cannot reconnect to Agora's edge server 10 seconds
   * after its connection to the server is interrupted.
   *
   * The SDK triggers this callback when it cannot connect to the server 10
   * seconds after calling the {@link joinChannel} method, whether or not it
   * is in the channel.
   */
   on(evt: 'connectionLost', cb: () => void): this;
  /** Occurs when the token expires.
   *
   * After a token(channel key) is specified by calling the {@link joinChannel}
   * method,
   * if the SDK losses connection with the Agora server due to network issues,
   * the token may expire after a certain period
   * of time and a new token may be required to reconnect to the server.
   *
   * This callback notifies the application to generate a new token and call
   * {@link joinChannel} to rejoin the channel with the new token.
   */
   on(evt: 'requestToken', cb: () => void): this;
  /** Occurs when the token expires in 30 seconds.
   *
   * The user becomes offline if the token used in the {@link joinChannel}
   * method expires. The SDK triggers this callback 30 seconds
   * before the token expires to remind the application to get a new token.
   * Upon receiving this callback, generate a new token
   * on the server and call the {@link renewToken} method to pass the new
   * token to the SDK.
   *
   * @param cb.token The token that expires in 30 seconds.
   */
   on(evt: 'tokenPrivilegeWillExpire', cb: (token: string) => void): this;
   /** Reports the statistics of the AgoraRtcChannel once every two seconds.
   *
   * @param cb.stats AgoraRtcChannel's statistics, see {@link RtcStats}
   */
   on(evt: 'rtcStats', cb: (stats: RtcStats) => void): this;
   /**
   * Reports the last mile network quality of each user in the channel
   * once every two seconds.
   *
   * Last mile refers to the connection between the local device and Agora's
   * edge server.
   *
   * @param cb.uid User ID. The network quality of the user with this uid is
   * reported.
   * If uid is 0, the local network quality is reported.
   * @param cb.txquality Uplink transmission quality rating of the user in
   * terms of
   * the transmission bitrate, packet loss rate, average RTT (Round-Trip Time),
   * and jitter of the uplink network. See {@link AgoraNetworkQuality}.
   * @param cb.rxquality Downlink network quality rating of the user in terms
   * of the
   * packet loss rate, average RTT, and jitter of the downlink network.
   * See {@link AgoraNetworkQuality}.
   */
   on(
    evt: 'networkQuality',
    cb: (
      uid: number,
      txquality: AgoraNetworkQuality,
      rxquality: AgoraNetworkQuality
    ) => void
  ): this;
  /** Reports the statistics of the video stream from each remote user/host.
   *
   * @param cb.stats Statistics of the received remote video streams. See
   * {@link RemoteVideoState}.
   */
  on(evt: 'remoteVideoStats', cb: (stats: RemoteVideoStats) => void): this;
  /** Reports the statistics of the audio stream from each remote user/host.
   *
   * @param cb.stats Statistics of the received remote audio streams. See
   * {@link RemoteAudioStats}.
   */
  on(evt: 'remoteAudioStats', cb: (stats: RemoteAudioStats) => void): this;
  /**
   * Occurs when the remote audio state changes.
   *
   * This callback indicates the state change of the remote audio stream.
   *
   * @param cb.uid ID of the remote user whose audio state changes.
   *
   * @param cb.state State of the remote audio:
   * {@link RemoteAudioState}.
   *
   * @param cb.reason The reason of the remote audio state change:
   * {@link RemoteAudioStateReason}.
   *
   * @param cb.elapsed Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
   on(evt: 'remoteAudioStateChanged', cb: (
    uid: number,
    state: RemoteAudioState,
    reason: RemoteAudioStateReason,
    elapsed: number
  ) => void): this;
  /**
   * Reports which user is the loudest speaker.
   *
   * This callback returns the user ID of the user with the highest voice
   * volume during a period of time, instead of at the moment.
   *
   * @note To receive this callback, you need to call the
   * {@link enableAudioVolumeIndication} method.
   *
   * @param cb.uid User ID of the active speaker. A uid of 0 represents the
   * local user.
   * If the user enables the audio volume indication by calling the
   * {@link enableAudioVolumeIndication} method, this callback returns the uid
   * of the
   * active speaker detected by the audio volume detection module of the SDK.
   *
   */
   on(evt: 'activeSpeaker', cb: (uid: number) => void): this;
  /** @deprecated This callback is deprecated, please use
   * `remoteVideoStateChanged` instead.
   *
   * Occurs when the first remote video frame is rendered.
   *
   * The SDK triggers this callback when the first frame of the remote video
   * is displayed in the user's video window.
   *
   * @param cb.uid User ID of the remote user sending the video stream.
   * @param cb.width Width (pixels) of the video frame.
   * @param cb.height Height (pixels) of the video stream.
   * @param cb.elapsed Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
   on(
    evt: 'firstRemoteVideoFrame',
    cb: (uid: number, width: number, height: number, elapsed: number) => void
  ): this;
  /** @deprecated This callback is deprecated, please use
   * `remoteAudioStateChanged` instead.
   *
   * Occurs when the engine receives the first audio frame from a specified
   * remote user.
   * @param cb.uid User ID of the remote user sending the audio stream.
   * @param cb.elapsed The time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
   on(
    evt: 'firstRemoteAudioDecoded',
    cb: (uid: number, elapsed: number) => void
  ): this;
  /** Occurs when the video size or rotation of a specified user changes.
   * @param cb.uid User ID of the remote user or local user (0) whose video
   * size or
   * rotation changes.
   * @param cb.width New width (pixels) of the video.
   * @param cb.height New height (pixels) of the video.
   * @param cb.roation New height (pixels) of the video.
   */
  on(
    evt: 'videoSizeChanged',
    cb: (uid: number, width: number, height: number, rotation: number) => void
  ): this;
  /** Occurs when the remote video state changes.
   *
   * @param cb.uid ID of the user whose video state changes.
   * @param cb.state State of the remote video.
   * See {@link RemoteVideoState}.
   * @param cb.reason The reason of the remote video state change.
   * See {@link RemoteVideoStateReason}
   * @param cb.elapsed Time elapsed (ms) from the local user calling the
   * {@link joinChannel} method until the SDK triggers this callback.
   */
   on(
    evt: 'remoteVideoStateChanged',
    cb: (
      uid: number,
      state: RemoteVideoState,
      reason: RemoteVideoStateReason,
      elapsed: number
    ) => void
  ): this;
  /** Occurs when the local user receives the data stream from the remote
   * user within five seconds.
   *
   * The SDK triggers this callback when the local user receives the stream
   * message that the remote user sends by calling the
   * {@link sendStreamMessage} method.
   * @param cb.uid User ID of the remote user sending the message.
   * @param cb.streamId Stream ID.
   * @param cb.data The data received bt the local user.
   */
   on(
    evt: 'streamMessage',
    cb: (uid: number, streamId: number, data: string) => void
  ): this;
  /** Occurs when the local user does not receive the data stream from the
   * remote user within five seconds.
   *
   * The SDK triggers this callback when the local user fails to receive the
   * stream message that the remote user sends by calling the
   * {@link sendStreamMessage} method.
   *
   * @param cb.uid User ID of the remote user sending the message.
   * @param cb.streamId Stream ID.
   * @param cb.err Error code.
   * @param cb.missed Number of the lost messages.
   * @param cb.cached Number of incoming cached messages when the data stream
   * is interrupted.
   */
  on(
    evt: 'streamMessageError',
    cb: (
      uid: number,
      streamId: number,
      code: number,
      missed: number,
      cached: number
    ) => void
  ): this;
  /**
   * Occurs when the state of the media stream relay changes.
   *
   * The SDK reports the state of the current media relay and possible error
   * messages in this callback.
   *
   * @param cb.state The state code. See {@link ChannelMediaRelayState}.
   * @param cb.code The error code. See {@link ChannelMediaRelayError}.
   */
   on(evt: 'channelMediaRelayState', cb: (
    state: ChannelMediaRelayState,
    code: ChannelMediaRelayError
  ) => void): this;
  /**
   * Reports events during the media stream relay.
   *
   * @param cb.event The event code. See {@link ChannelMediaRelayEvent}.
   */
  on(evt: 'channelMediaRelayEvent', cb: (
    event: ChannelMediaRelayEvent
  ) => void): this;
  /** @deprecated This callback is deprecated. Please use
   * `remoteAudioStateChanged` instead.
   *
   * Occurs when the engine receives the first audio frame from a specific
   * remote user.
   *
   * @param cb.uid User ID of the remote user.
   * @param cb.elapsed Time elapsed (ms) from the local user calling
   * {@link joinChannel} until the
   * SDK triggers this callback.
   */
   on(
    evt: 'firstRemoteAudioFrame',
    cb: (uid: number, elapsed: number) => void
  ): this;

  on(evt: string, listener: Function): this;
  /**
   * Occurs when the state of the RTMP or RTMPS streaming changes.
   *
   * The SDK triggers this callback to report the result of the local user
   * calling the {@link addPublishStreamUrl} and {@link removePublishStreamUrl}
   * method.
   *
   * This callback indicates the state of the RTMP streaming. When exceptions
   * occur, you can troubleshoot issues by referring to the detailed error
   * descriptions in the `code` parameter.
   * @param cb.url The RTMP URL address.
   * @param cb.state The RTMP streaming state:
   * - `0`: The RTMP streaming has not started or has ended. This state is also
   * triggered after you remove an RTMP address from the CDN by calling
   * {@link removePublishStreamUrl}.
   * - `1`: The SDK is connecting to Agora's streaming server and the RTMP
   * server. This state is triggered after you call the
   * {@link addPublishStreamUrl} method.
   * - `2`: The RTMP streaming publishes. The SDK successfully publishes the
   * RTMP streaming and returns this state.
   * - `3`: The RTMP streaming is recovering. When exceptions occur to the CDN,
   * or the streaming is interrupted, the SDK tries to resume RTMP streaming
   * and returns this state.
   *  - If the SDK successfully resumes the streaming, `2` returns.
   *  - If the streaming does not resume within 60 seconds or server errors
   * occur, `4` returns. You can also reconnect to the server by calling the
   * {@link removePublishStreamUrl} and then {@link addPublishStreamUrl}
   * method.
   * - `4`: The RTMP streaming fails. See the `code` parameter for the
   * detailed error information. You can also call the
   * {@link addPublishStreamUrl} method to publish the RTMP streaming again.
   * @param cb.code The detailed error information:
   * - `0`: The RTMP streaming publishes successfully.
   * - `1`: Invalid argument used.
   * - `2`: The RTMP streams is encrypted and cannot be published.
   * - `3`: Timeout for the RTMP streaming. Call the
   * {@link addPublishStreamUrl} to publish the stream again.
   * - `4`: An error occurs in Agora's streaming server. Call the
   * {@link addPublishStreamUrl} to publish the stream again.
   * - `5`: An error occurs in the RTMP server.
   * - `6`: The RTMP streaming publishes too frequently.
   * - `7`: The host publishes more than 10 URLs. Delete the unnecessary URLs
   * before adding new ones.
   * - `8`: The host manipulates other hosts' URLs. Check your app
   * logic.
   * - `9`: Agora's server fails to find the RTMP stream.
   * - `10`: The format of the stream's URL address is not supported. Check
   * whether the URL format is correct.
   */
  on(evt: 'rtmpStreamingStateChanged', cb: (url: string, state: number, code: number) => void): this;
  /** Occurs when the publisher's transcoding is updated. */
  on(evt: 'transcodingUpdated', cb: () => void): this;
  /** Occurs when a voice or video stream URL address is added to a live
   * broadcast.
   *
   * @param cb.url The URL address of the externally injected stream.
   * @param cb.uid User ID.
   * @param cb.status State of the externally injected stream:
   *  - 0: The external video stream imported successfully.
   *  - 1: The external video stream already exists.
   *  - 2: The external video stream to be imported is unauthorized.
   *  - 3: Import external video stream timeout.
   *  - 4: Import external video stream failed.
   *  - 5: The external video stream stopped importing successfully.
   *  - 6: No external video stream is found.
   *  - 7: No external video stream is found.
   *  - 8: Stop importing external video stream timeout.
   *  - 9: Stop importing external video stream failed.
   *  - 10: The external video stream is corrupted.
   *
   */
   on(
    evt: 'streamInjectedStatus',
    cb: (url: string, uid: number, status: number) => void
  ): this;
  /** Occurs when the remote media stream falls back to audio-only stream due
   * to poor network conditions or switches back to the video stream after the
   * network conditions improve.
   *
   * If you call {@link setRemoteSubscribeFallbackOption} and set option as
   * AUDIO_ONLY(2), the SDK triggers this callback when
   * the remotely subscribed media stream falls back to audio-only mode due to
   * poor uplink conditions, or when the remotely subscribed media stream
   * switches back to the video after the uplink network condition improves.
   * @param cb.uid ID of the remote user sending the stream.
   * @param cb.isFallbackOrRecover Whether the remote media stream falls back
   * to audio-only or switches back to the video:
   *  - `true`: The remote media stream falls back to audio-only due to poor
   * network conditions.
   *  - `false`: The remote media stream switches back to the video stream
   * after the network conditions improved.
   */
  on(evt: 'remoteSubscribeFallbackToAudioOnly', cb: (
    uid: number,
    isFallbackOrRecover: boolean
  ) => void): this;
  // on(evt: 'refreshRecordingServiceStatus', cb: () => void): this;
  /** Occurs when the connection state between the SDK and the server changes.
   * @param cb.state The connection state, see {@link ConnectionState}.
   * @param cb.reason The connection reason, see {@link ConnectionState}.
   */
  on(evt: 'connectionStateChanged', cb: (
    state: ConnectionState,
    reason: ConnectionChangeReason
  ) => void): this;
  /** Occurs when the audio publishing state changes.
   *
   * @since v3.2.0
   *
   * This callback indicates the publishing state change of the local audio
   * stream.
   *
   * @param cb.channel The channel name.
   * @param cb.oldState The previous publishing state.
   * @param cb.newState The current publishing state.
   * @param cb.elapseSinceLastState The time elapsed (ms) from the previous state
   * to the current state.
   */
  on(evt: 'audioPublishStateChanged', cb: (
    oldState: STREAM_PUBLISH_STATE,
    newState: STREAM_PUBLISH_STATE,
    elapseSinceLastState: number
  )=> void): this;
  /** Occurs when the video publishing state changes.
   *
   * @since v3.2.0
   *
   * This callback indicates the publishing state change of the local video
   * stream.
   *
   * @param cb.channel The channel name.
   * @param cb.oldState The previous publishing state.
   * @param cb.newState The current publishing state.
   * @param cb.elapseSinceLastState The time elapsed (ms) from the previous state
   * to the current state.
   */
  on(evt: 'videoPublishStateChanged', cb: (
    oldState: STREAM_PUBLISH_STATE,
    newState: STREAM_PUBLISH_STATE,
    elapseSinceLastState: number
  )=> void): this;
  /** Occurs when the audio subscribing state changes.
   *
   * @since v3.2.0
   *
   * This callback indicates the subscribing state change of a remote audio
   * stream.
   *
   * @param cb.channel The channel name.
   * @param cb.uid The ID of the remote user.
   * @param cb.oldState The previous subscribing state.
   * @param cb.newState The current subscribing state.
   * @param cb.elapseSinceLastState The time elapsed (ms) from the previous state
   * to the current state.
   */
  on(evt: 'audioSubscribeStateChanged', cb: (
    uid: number,
    oldState: STREAM_SUBSCRIBE_STATE,
    newState: STREAM_SUBSCRIBE_STATE,
    elapseSinceLastState: number
  )=> void): this;
  /** Occurs when the video subscribing state changes.
   *
   * @since v3.2.0
   *
   * This callback indicates the subscribing state change of a remote video
   * stream.
   *
   * @param cb.channel The channel name.
   * @param cb.uid The ID of the remote user.
   * @param cb.oldState The previous subscribing state.
   * @param cb.newState The current subscribing state.
   * @param cb.elapseSinceLastState The time elapsed (ms) from the previous state
   * to the current state.
   */
  on(evt: 'videoSubscribeStateChanged', cb: (
    uid: number,
    oldState: STREAM_SUBSCRIBE_STATE,
    newState: STREAM_SUBSCRIBE_STATE,
    elapseSinceLastState: number
  )=> void): this;
}

export default AgoraRtcEngine;
