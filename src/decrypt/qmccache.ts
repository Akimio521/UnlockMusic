import {
  AudioMimeType,
  GetArrayBuffer,
  GetCoverFromFile,
  GetMetaFromFile,
  SniffAudioExt,
  SplitFilename,
} from '@/decrypt/utils';

import { Decrypt as QmcDecrypt, HandlerMap } from '@/decrypt/qmc';
import { DecryptQmcWasm } from '@/decrypt/qmc_wasm';

import { DecryptResult } from '@/decrypt/entity';

import { parseBlob as metaParseBlob } from 'music-metadata-browser';

export async function Decrypt(file: Blob, raw_filename: string, raw_ext: string): Promise<DecryptResult> {
  const buffer = await GetArrayBuffer(file);

  let musicDecoded: Uint8Array | undefined;
  if (globalThis.WebAssembly) {
    console.log('qmc: using wasm decoder');

    const qmcDecrypted = await DecryptQmcWasm(buffer, raw_ext);
    // 若 qmc 检测失败，降级到 v1 再尝试一次
    if (qmcDecrypted.success) {
      musicDecoded = qmcDecrypted.data;
      console.log('qmc wasm decoder suceeded');
    } else {
      console.warn('QmcWasm failed with error %s', qmcDecrypted.error || '(no error)');
    }
  }

  if (!musicDecoded) {
    musicDecoded = new Uint8Array(buffer);
    let length = musicDecoded.length;
    for (let i = 0; i < length; i++) {
      musicDecoded[i] ^= 0xf4;
      if (musicDecoded[i] <= 0x3f) musicDecoded[i] = musicDecoded[i] * 4;
      else if (musicDecoded[i] <= 0x7f) musicDecoded[i] = (musicDecoded[i] - 0x40) * 4 + 1;
      else if (musicDecoded[i] <= 0xbf) musicDecoded[i] = (musicDecoded[i] - 0x80) * 4 + 2;
      else musicDecoded[i] = (musicDecoded[i] - 0xc0) * 4 + 3;
    }
  }
  let ext = SniffAudioExt(musicDecoded, '');
  const newName = SplitFilename(raw_filename);
  let audioBlob: Blob;
  if (ext !== '' || newName.ext === 'mp3') {
    audioBlob = new Blob([musicDecoded], { type: AudioMimeType[ext] });
  } else if (newName.ext in HandlerMap) {
    audioBlob = new Blob([musicDecoded], { type: 'application/octet-stream' });
    return QmcDecrypt(audioBlob, newName.name, newName.ext);
  } else {
    throw '不支持的QQ音乐缓存格式';
  }
  const tag = await metaParseBlob(audioBlob);
  const { title, artist } = GetMetaFromFile(raw_filename, tag.common.title, String(tag.common.artists || tag.common.artist));

  return {
    title,
    artist,
    ext,
    album: tag.common.album,
    picture: GetCoverFromFile(tag),
    file: URL.createObjectURL(audioBlob),
    blob: audioBlob,
    mime: AudioMimeType[ext],
  };
}
