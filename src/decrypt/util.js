const ID3Writer = require("browser-id3-writer");


export const IXAREA_API_ENDPOINT = "https://stats.ixarea.com/apis"


export async function WriteMp3Meta(audioData, artistList, title, album, pictureData = null, pictureDesc = "Cover", originalMeta = null) {
    const writer = new ID3Writer(audioData);
    if (originalMeta !== null) {
        artistList = originalMeta.common.artists || artistList
        title = originalMeta.common.title || title
        album = originalMeta.common.album || album
        const frames = originalMeta.native['ID3v2.4'] || originalMeta.native['ID3v2.3'] || originalMeta.native['ID3v2.2'] || []
        frames.forEach(frame => {
            if (frame.id !== 'TPE1' && frame.id !== 'TIT2' && frame.id !== 'TALB') {
                try {
                    writer.setFrame(frame.id, frame.value)
                } catch (e) {
                }
            }
        })
    }
    writer.setFrame('TPE1', artistList)
        .setFrame('TIT2', title)
        .setFrame('TALB', album);
    if (pictureData !== null) {
        writer.setFrame('APIC', {
            type: 3,
            data: pictureData,
            description: pictureDesc,
        })
    }
    writer.addTag();
    return writer.arrayBuffer;
}

