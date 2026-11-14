// Renders schedule.json + mix.wav into a 1080p MP4: each screenshot on a light canvas with the
// caption as subtitles on the bottom bar, short cross-fades between shots, narration underneath.
// swiftc -O render.swift -o render && ./render <dir> <out.mp4>
import AVFoundation
import AppKit
import CoreText

struct Shot: Decodable { let image: String; let start: Double; let end: Double; let caption: String }
let args = CommandLine.arguments
let dir = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let shots = try! JSONDecoder().decode([Shot].self, from: Data(contentsOf: dir.appendingPathComponent("schedule.json")))
let W = 1920, H = 1080, FPS = 24
let total = shots.last!.end

let cs = CGColorSpaceCreateDeviceRGB()
func compose(_ s: Shot) -> CGImage {
    let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue)!
    ctx.setFillColor(CGColor(red: 0.96, green: 0.955, blue: 0.985, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
    let img = NSImage(contentsOfFile: s.image)!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
    let w = 1760.0
    let h = w * Double(img.height) / Double(img.width)
    ctx.draw(img, in: CGRect(x: (Double(W) - w) / 2, y: Double(H) - 70 - h, width: w, height: h))
    // subtitle bar
    let style = NSMutableParagraphStyle(); style.alignment = .center; style.lineBreakMode = .byWordWrapping
    let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 30, weight: .medium), .foregroundColor: NSColor(calibratedRed: 0.09, green: 0.09, blue: 0.16, alpha: 1), .paragraphStyle: style]
    let str = NSAttributedString(string: s.caption, attributes: attrs)
    let fs = CTFramesetterCreateWithAttributedString(str)
    let path = CGPath(rect: CGRect(x: 120, y: 30, width: W - 240, height: 110), transform: nil)
    let frame = CTFramesetterCreateFrame(fs, CFRangeMake(0, 0), path, nil)
    CTFrameDraw(frame, ctx)
    // badge
    let badge = NSAttributedString(string: "Lynksy  ·  Powered by Gnani AI", attributes: [.font: NSFont.systemFont(ofSize: 22, weight: .semibold), .foregroundColor: NSColor(calibratedRed: 0.31, green: 0.27, blue: 0.9, alpha: 1)])
    let line = CTLineCreateWithAttributedString(badge)
    ctx.textPosition = CGPoint(x: 40, y: Double(H) - 46); CTLineDraw(line, ctx)
    return ctx.makeImage()!
}
let composed = shots.map(compose)

func pixelBuffer(_ a: CGImage, _ b: CGImage?, _ mix: Double, _ pool: CVPixelBufferPool) -> CVPixelBuffer {
    var pb: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb)
    let buf = pb!; CVPixelBufferLockBaseAddress(buf, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.draw(a, in: CGRect(x: 0, y: 0, width: W, height: H))
    if let b = b { ctx.setAlpha(mix); ctx.draw(b, in: CGRect(x: 0, y: 0, width: W, height: H)) }
    CVPixelBufferUnlockBaseAddress(buf, [])
    return buf
}

let silent = dir.appendingPathComponent("silent.mp4"); try? FileManager.default.removeItem(at: silent)
let writer = try! AVAssetWriter(outputURL: silent, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H, AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 6_000_000]])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H])
writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
let fade = 0.4
var frameNo = 0
let n = Int(total * Double(FPS))
for f in 0..<n {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    let t = Double(f) / Double(FPS)
    let i = shots.firstIndex(where: { t < $0.end }) ?? shots.count - 1
    var next: CGImage? = nil, mix = 0.0
    if i + 1 < shots.count, t > shots[i].end - fade { next = composed[i + 1]; mix = (t - (shots[i].end - fade)) / fade }
    let pb = pixelBuffer(composed[i], next, mix, adaptor.pixelBufferPool!)
    adaptor.append(pb, withPresentationTime: CMTime(value: Int64(f), timescale: CMTimeScale(FPS)))
    frameNo += 1
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0); writer.finishWriting { sem.signal() }; sem.wait()

// Add the audio.
let comp = AVMutableComposition()
let vAsset = AVURLAsset(url: silent), aAsset = AVURLAsset(url: dir.appendingPathComponent("mix.wav"))
let vt = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
let at = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
let vTrack = vAsset.tracks(withMediaType: .video)[0], aTrack = aAsset.tracks(withMediaType: .audio)[0]
try! vt.insertTimeRange(CMTimeRange(start: .zero, duration: vAsset.duration), of: vTrack, at: .zero)
try! at.insertTimeRange(CMTimeRange(start: .zero, duration: min(aAsset.duration, vAsset.duration)), of: aTrack, at: .zero)
try? FileManager.default.removeItem(at: outURL)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality)!
ex.outputURL = outURL; ex.outputFileType = .mp4
let sem2 = DispatchSemaphore(value: 0); ex.exportAsynchronously { sem2.signal() }; sem2.wait()
print("export:", ex.status.rawValue, ex.error?.localizedDescription ?? "ok", String(format: "%.1fs", total))
