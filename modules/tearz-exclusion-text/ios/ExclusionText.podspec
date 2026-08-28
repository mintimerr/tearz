require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExclusionText'
  s.version        = package['version']
  s.summary        = 'UITextView with exclusion paths for Tearz terminal'
  s.license        = 'MIT'
  s.author         = 'Tearz'
  s.homepage       = 'https://tearz.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.source_files   = '**/*.{h,m,swift}'
  s.dependency 'ExpoModulesCore'
end
