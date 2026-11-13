require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ValiMarkdown"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :visionos => 1.0 }
  # Wrapper translation units include the pinned vendor C/header files.
  s.preserve_paths = ["vendor/tree-sitter/**/*"]
  s.source       = { :git => "https://github.com/Vali-98/react-native-markdown-display.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{h,m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
    "vendor/md4c/*.{h,c}",
  ]

  s.public_header_files = ["ios/MarkdownEditorAnalyzer.h"]

  # Per-app settings: the package next to ios/, including monorepo apps.
  app_root = ENV['VALI_MARKDOWN_APP_ROOT'] || File.expand_path('..', Pod::Config.instance.installation_root.to_s)
  config_json = IO.popen(['node', File.join(__dir__, 'scripts/highlight-config.cjs'), File.join(app_root, 'package.json')], &:read)
  raise 'Invalid ValiMarkdown highlighting configuration' unless $?.success?
  highlight = JSON.parse(config_json)
  if highlight['enabled']
    s.source_files = Array(s.attributes_hash['source_files']) + highlight['sources']
  end

  # Keep the performance-critical C/C++ parser and grammars optimized in Debug
  # too, retaining debug symbols and assertions without unoptimized STL overhead.
  s.pod_target_xcconfig = { 'GCC_OPTIMIZATION_LEVEL' => '2', 'GCC_PREPROCESSOR_DEFINITIONS' => ['$(inherited)', *highlight['defines']].join(' '), 'CLANG_C_LANGUAGE_STANDARD' => 'c11', 'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_TARGET_SRCROOT}/cpp" "${PODS_TARGET_SRCROOT}/vendor/md4c" "${PODS_TARGET_SRCROOT}/vendor/tree-sitter/runtime/lib/include" "${PODS_TARGET_SRCROOT}/vendor/tree-sitter/typescript/typescript/src"' }

  load 'nitrogen/generated/ios/ValiMarkdown+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
