use std::path::Path;

mod storage;

const PATH: &'static str = r#"\\10.2.4.16\Public\Works\Photos"#;

fn app() -> clap::Command {
  use clap::{Arg, ArgAction, value_parser};
  clap::Command::new("frog")
    .bin_name("frog")
    .author("Kaede Fujisaki")
    .about("Frog call analyzer")
    .version("0.1.0")
    .arg(Arg::new("verbose")
      .long("verbose")
      .short('v')
      .required(false)
      .action(ArgAction::Count)
      .value_parser(value_parser!(u8))
      .help("Show verbose message"))
    .arg(Arg::new("STORAGE")
      .long("storage")
      .required(true)
      .action(ArgAction::Set)
      .value_parser(value_parser!(String))
      .help("File origin"))
    .arg(Arg::new("INPUT")
      .long("input")
      .required(true)
      .action(ArgAction::Set)
      .value_parser(value_parser!(String))
      .help("Input file (md5 hash list)"))
    .arg(Arg::new("OUTPUT")
      .long("output")
      .required(true)
      .action(ArgAction::Set)
      .value_parser(value_parser!(String))
      .help("Output storage path"))

}

fn main() -> anyhow::Result<()> {
  use tracing_subscriber::util::SubscriberInitExt;
  tracing_subscriber::fmt()
    .with_timer(tracing_subscriber::fmt::time::ChronoLocal::new("%Y/%m/%d %H:%M:%S%.3f".to_string()))
    .with_max_level(tracing::Level::INFO)
    .with_line_number(true)
    .with_file(true)
    .with_writer(std::io::stderr)
    .finish()
    .init();
  use tracing::info;
  let m = app().get_matches();
  let input = m.get_one::<String>("INPUT").expect("[BUG] No INPUT");
  let output = m.get_one::<String>("OUTPUT").expect("[BUG] No OUTPUT");
  let storage = m.get_one::<String>("STORAGE").expect("[BUG] No PATH");
  info!("input: {}", input);
  info!("output: {}", output);
  info!("storage: {}", storage);

  // Read the input hashes
  info!("[{}] reading input file.", input);
  let (mut images, duration) = {
    let beg = std::time::Instant::now();
    let content = std::fs::read_to_string(input)?;
    let mut images = std::collections::HashSet::new();
    for id in content.split("\n") {
      images.insert(id.to_string());
    }
    let end = std::time::Instant::now();
    (images, end.duration_since(beg))
  };
  info!("[{}] {} images, took {} [ms]", input, images.len(), duration.as_millis());

  // Walk the storage dir.
  std::fs::create_dir_all(output)?;
  storage::walk(Path::new(storage), |hash, path| {
    if !images.contains(hash) {
      return Ok(());
    }
    let d1 = &hash[0..2];
    let d2 = &hash[2..4];
    let d3 = &hash[4..6];
    let f = &hash[6..];
    let dst = Path::new(output).join(d1).join(d2).join(d3);
    std::fs::create_dir_all(dst.clone())?;
    std::fs::copy(path, dst.join(f))?;
    images.remove(hash);
    Ok(())
  });

  // Copy to the output.
  for hash in images {
    info!("image with hash={} not found", hash);
  }

  Ok(())
}
