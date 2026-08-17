import Foundation
import AppKit
import ImageIO

// Builds an iOS app icon from a logo with a gold border ring and rounded
// corners baked in, and optionally previews it under iOS's own corner mask.
//
// Why it takes this shape:
//
//  * Scale-and-centre so the ring's STRAIGHT segments fall outside the frame.
//    Pure arithmetic: the span inside the ring must exceed the frame.
//  * Then paint over the corners, because the ring's CORNER ARCS curve much
//    further inward than its straight segments — measured here, the arc comes
//    within ~55px of the corner while the straight edge sits 52px outside the
//    frame. Scaling further to clear the arcs would crop the artwork badly, so
//    the corners get filled with the logo's own black instead.
//  * The corner fill radius stays well inside iOS's mask (~22.4% of width), so
//    it can only ever remove pixels iOS was going to hide anyway.
//
// usage: makeicon4 <src> <out> <size> <ringInset> <bleed> <cornerRadiusPct> [--preview <path>]

let a = CommandLine.arguments
guard let img = NSImage(contentsOfFile: a[1]),
      let tiff = img.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff) else { print("load failed"); exit(1) }
let outPath = a[2]
let outSize = Double(a[3]) ?? 1024
let ringInset = Double(a[4]) ?? 57
let bleed = Double(a[5]) ?? 14
let cornerPct = Double(a[6]) ?? 0.195
let previewPath: String? = a.count > 8 && a[7] == "--preview" ? a[8] : nil

let w = Double(rep.pixelsWide), h = Double(rep.pixelsHigh)
let scale = (outSize + 2 * bleed) / (w - 2 * ringInset)
let drawW = w * scale, drawH = h * scale
let originX = (outSize - drawW) / 2, originY = (outSize - drawH) / 2
let bg = rep.colorAt(x: Int(ringInset) + 20, y: rep.pixelsHigh / 2) ?? .black

print(String(format: "scale %.4f, drawn at (%.0f, %.0f)", scale, originX, originY))
print(String(format: "corner fill radius %.0f px (iOS masks at ~%.0f px, so this only removes hidden pixels)",
             outSize * cornerPct, outSize * 0.224))

func render(masked: Bool, to path: String) {
    guard let cg = rep.cgImage,
          let ctx = CGContext(data: nil, width: Int(outSize), height: Int(outSize),
            bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
    ctx.interpolationQuality = .high
    if !masked {
        ctx.setFillColor(bg.cgColor)
        ctx.fill(CGRect(x: 0, y: 0, width: outSize, height: outSize))
    }
    let frame = CGRect(x: 0, y: 0, width: outSize, height: outSize)
    if masked {
        // Show it the way iOS will: clipped to the system squircle.
        ctx.addPath(CGPath(roundedRect: frame, cornerWidth: outSize * 0.224,
                           cornerHeight: outSize * 0.224, transform: nil))
        ctx.clip()
        ctx.setFillColor(bg.cgColor)
        ctx.fill(frame)
    }
    ctx.draw(cg, in: CGRect(x: originX, y: originY, width: drawW, height: drawH))

    // Clear the four corners: fill everything outside a rounded rect with the
    // logo's own black, which erases the ring's corner arcs.
    let r = outSize * cornerPct
    let keep = CGPath(roundedRect: frame, cornerWidth: r, cornerHeight: r, transform: nil)
    ctx.saveGState()
    ctx.addRect(frame)
    ctx.addPath(keep)
    ctx.setFillColor(bg.cgColor)
    ctx.fillPath(using: .evenOdd)
    ctx.restoreGState()

    guard let image = ctx.makeImage(),
          let dest = CGImageDestinationCreateWithURL(
            URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil) else { return }
    CGImageDestinationAddImage(dest, image, nil)
    CGImageDestinationFinalize(dest)
    print("wrote \(path)")
}

// The shipped icon must be fully opaque with no alpha channel, so re-render the
// unmasked version through a noneSkipLast context.
render(masked: false, to: outPath + ".rgba.png")
if let p = previewPath { render(masked: true, to: p) }

guard let staged = NSImage(contentsOfFile: outPath + ".rgba.png"),
      let stagedTiff = staged.tiffRepresentation,
      let stagedRep = NSBitmapImageRep(data: stagedTiff),
      let stagedCG = stagedRep.cgImage,
      let flat = CGContext(data: nil, width: Int(outSize), height: Int(outSize),
        bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { print("flatten failed"); exit(1) }
flat.setFillColor(bg.cgColor)
flat.fill(CGRect(x: 0, y: 0, width: outSize, height: outSize))
flat.draw(stagedCG, in: CGRect(x: 0, y: 0, width: outSize, height: outSize))
guard let flatImage = flat.makeImage(),
      let dest = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: outPath) as CFURL, "public.png" as CFString, 1, nil)
else { print("final encode failed"); exit(1) }
CGImageDestinationAddImage(dest, flatImage, nil)
CGImageDestinationFinalize(dest)
try? FileManager.default.removeItem(atPath: outPath + ".rgba.png")
print("wrote \(outPath) (opaque, no alpha)")
