pub fn make_hasher() -> imagehash::AverageHash {
  imagehash::AverageHash::new()
    .with_image_size(512, 512)
    .with_hash_size(512, 512)
    .with_resizer(|img, w, h| {
      img.resize_exact(w as u32, h as u32, image::imageops::FilterType::Lanczos3)
    })
}
