//! Per-pixel hot path for offline generation.
//! Ports `src/keying.ts` (`keyImageData`) and `src/blur.ts` (`boxBlurRgba`).
//! Canvas2D layout / jump-zoom FX stay in JS for visual parity.

#![no_std]
#![no_main]

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

fn clamp01(v: f64) -> f64 {
    if v < 0.0 {
        0.0
    } else if v > 1.0 {
        1.0
    } else {
        v
    }
}

fn clampi(value: i32, min: i32, max: i32) -> i32 {
    value.max(min).min(max)
}

extern "C" {
    fn sqrt(x: f64) -> f64;
}

fn color_distance(r: f64, g: f64, b: f64, kr: f64, kg: f64, kb: f64) -> f64 {
    let dr = r - kr;
    let dg = g - kg;
    let db = b - kb;
    unsafe { sqrt(dr * dr + dg * dg + db * db) }
}

fn luma(r: f64, g: f64, b: f64) -> f64 {
    r * 0.299 + g * 0.587 + b * 0.114
}

fn clamp_u8_round(v: f64) -> u8 {
    if v <= 0.0 {
        0
    } else if v >= 255.0 {
        255
    } else {
        (v + 0.5) as u8
    }
}

#[no_mangle]
pub extern "C" fn key_image(data: *mut u8, width: i32, height: i32) {
    if data.is_null() || width < 1 || height < 1 {
        return;
    }
    let pixels = (width as usize) * (height as usize) * 4;
    let buf = unsafe { core::slice::from_raw_parts_mut(data, pixels) };

    let points = [
        [2, 2],
        [width - 3, 2],
        [width / 2, 3],
        [(width as f64 * 0.15) as i32, (height as f64 * 0.04) as i32],
        [(width as f64 * 0.85) as i32, (height as f64 * 0.04) as i32],
        [2, height - 3],
        [width - 3, height - 3],
    ];

    let mut sr = 0.0;
    let mut sg = 0.0;
    let mut sb = 0.0;
    for [x, y] in points {
        let i = ((y * width + x) * 4) as usize;
        sr += buf[i] as f64;
        sg += buf[i + 1] as f64;
        sb += buf[i + 2] as f64;
    }
    let kr = sr / 7.0;
    let kg = sg / 7.0;
    let kb = sb / 7.0;

    const TOLERANCE: f64 = 38.0;
    const SOFTNESS: f64 = 22.0;
    const DARK_PROTECT: f64 = 48.0;
    const GREEN_BOOST: f64 = 18.0;
    const GREEN_SOFT: f64 = 40.0;

    let mut i = 0;
    while i < pixels {
        let r = buf[i] as f64;
        let g = buf[i + 1] as f64;
        let b = buf[i + 2] as f64;
        let dist = color_distance(r, g, b, kr, kg, kb);
        let mut alpha = clamp01((dist - TOLERANCE) / SOFTNESS);
        let green_screen = g - r.max(b);
        let green_kill = clamp01((green_screen.max(0.0) - GREEN_BOOST) / GREEN_SOFT) * 0.85;
        alpha = alpha.min(1.0 - green_kill);
        if luma(r, g, b) < DARK_PROTECT {
            alpha = 1.0;
        }
        let spill = 1.0 - clamp01((dist - TOLERANCE * 0.4) / (TOLERANCE + SOFTNESS));
        let y = luma(r, g, b);
        let t = spill * 0.7;
        buf[i] = clamp_u8_round(r + (y - r) * t);
        buf[i + 1] = clamp_u8_round(g + (y - g) * t);
        buf[i + 2] = clamp_u8_round(b + (y - b) * t);
        buf[i + 3] = clamp_u8_round(alpha * 255.0);
        i += 4;
    }
}

fn js_round_div(sum: i32, extent: i32) -> u8 {
    ((sum as f64) / (extent as f64) + 0.5) as u8
}

fn blur_axis(src: &[u8], dst: &mut [u8], width: i32, height: i32, radius: i32, horizontal: bool) {
    let extent = radius * 2 + 1;
    let last_x = width - 1;
    let last_y = height - 1;
    if horizontal {
        for y in 0..height {
            let row = y * width * 4;
            let mut r = 0;
            let mut g = 0;
            let mut b = 0;
            let mut a = 0;
            let mut k = -radius;
            while k <= radius {
                let i = (row + clampi(k, 0, last_x) * 4) as usize;
                r += src[i] as i32;
                g += src[i + 1] as i32;
                b += src[i + 2] as i32;
                a += src[i + 3] as i32;
                k += 1;
            }
            for x in 0..width {
                let i = (row + x * 4) as usize;
                dst[i] = js_round_div(r, extent);
                dst[i + 1] = js_round_div(g, extent);
                dst[i + 2] = js_round_div(b, extent);
                dst[i + 3] = js_round_div(a, extent);
                let out = (row + clampi(x - radius, 0, last_x) * 4) as usize;
                let inn = (row + clampi(x + radius + 1, 0, last_x) * 4) as usize;
                r += src[inn] as i32 - src[out] as i32;
                g += src[inn + 1] as i32 - src[out + 1] as i32;
                b += src[inn + 2] as i32 - src[out + 2] as i32;
                a += src[inn + 3] as i32 - src[out + 3] as i32;
            }
        }
        return;
    }
    for x in 0..width {
        let mut r = 0;
        let mut g = 0;
        let mut b = 0;
        let mut a = 0;
        let mut k = -radius;
        while k <= radius {
            let i = ((clampi(k, 0, last_y) * width + x) * 4) as usize;
            r += src[i] as i32;
            g += src[i + 1] as i32;
            b += src[i + 2] as i32;
            a += src[i + 3] as i32;
            k += 1;
        }
        for y in 0..height {
            let i = ((y * width + x) * 4) as usize;
            dst[i] = js_round_div(r, extent);
            dst[i + 1] = js_round_div(g, extent);
            dst[i + 2] = js_round_div(b, extent);
            dst[i + 3] = js_round_div(a, extent);
            let out = ((clampi(y - radius, 0, last_y) * width + x) * 4) as usize;
            let inn = ((clampi(y + radius + 1, 0, last_y) * width + x) * 4) as usize;
            r += src[inn] as i32 - src[out] as i32;
            g += src[inn + 1] as i32 - src[out + 1] as i32;
            b += src[inn + 2] as i32 - src[out + 2] as i32;
            a += src[inn + 3] as i32 - src[out + 3] as i32;
        }
    }
}

#[no_mangle]
pub extern "C" fn box_blur_rgba(
    data: *mut u8,
    tmp: *mut u8,
    width: i32,
    height: i32,
    radius: i32,
    passes: i32,
) {
    if data.is_null() || tmp.is_null() || radius < 1 || width < 1 || height < 1 || passes < 1 {
        return;
    }
    let n = (width as usize) * (height as usize) * 4;
    let pixels = unsafe { core::slice::from_raw_parts_mut(data, n) };
    let scratch = unsafe { core::slice::from_raw_parts_mut(tmp, n) };
    for _ in 0..passes {
        blur_axis(pixels, scratch, width, height, radius, true);
        blur_axis(scratch, pixels, width, height, radius, false);
    }
}
