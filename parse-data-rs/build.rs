extern crate prost_build;

fn main() {
    let mut config = prost_build::Config::new();
    config.type_attribute(".", "#[derive(Serialize)]");
    config.compile_protos(&["src/ratings.proto"], &["src/"]).unwrap();
    //prost_build::compile_protos(&["src/ratings.proto"], &["src/"]).unwrap();
}
