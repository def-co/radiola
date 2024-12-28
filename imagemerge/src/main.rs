use sdl2::{self, pixels, rect::Rect, surface::Surface};
use sdl2::image::{self, LoadSurface, SaveSurface};
use std::fs;
use serde_json;

fn main() {
    let _ctx_sdl = sdl2::init().unwrap();
    let _ctx_img = image::init(image::InitFlag::PNG).unwrap();

    let mut entries: Vec<(String, Surface)> = fs::read_dir("../stations").unwrap()
        .filter_map(|entry| {
            let entry = entry.unwrap();
            let name = entry.file_name().into_string().unwrap();
            let name_parts = name.split(".");
            assert_eq!(name_parts.clone().count(), 2, "invalid name");
            if name_parts.clone().last().unwrap().to_lowercase() != "png" {
                return None;
            }

            let station = name_parts.clone().next().unwrap().to_string();
            let img = Surface::from_file(entry.path()).unwrap();

            Some((station, img))
        })
        .collect();
    entries.sort_by(|(a, _), (b, _)| a.cmp(b));

    let width: u32 = (entries.len() * 200).try_into().unwrap();
    let mut surface = Surface::new(width, 200, pixels::PixelFormatEnum::RGB888).unwrap();
    for (i, (_name, image)) in entries.iter().enumerate() {
        let offset = (200 * i).try_into().unwrap();
        let dest_rect = Rect::new(offset, 0, 200, 200);
        image.blit(None, &mut surface, Some(dest_rect)).unwrap();
    }

    surface.save("out.png").unwrap();

    let names: Vec<&String> = entries.iter().map(|entry| &entry.0).collect();
    let mut manifest = fs::File::create("out.manifest.json").unwrap();
    serde_json::to_writer(&mut manifest, &names).unwrap();
}
