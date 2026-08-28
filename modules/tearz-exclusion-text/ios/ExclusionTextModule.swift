import ExpoModulesCore

struct ExclusionRectRecord: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var width: Double = 0
  @Field var height: Double = 0
}

public final class ExclusionTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExclusionText")

    View(ExclusionTextView.self) {
      Prop("text") { (view: ExclusionTextView, text: String) in
        view.setText(text)
      }

      Prop("placeholder") { (view: ExclusionTextView, placeholder: String) in
        view.setPlaceholder(placeholder)
      }

      Prop("color") { (view: ExclusionTextView, color: UIColor) in
        view.setTextColor(color)
      }

      Prop("placeholderColor") { (view: ExclusionTextView, color: UIColor) in
        view.setPlaceholderColor(color)
      }

      Prop("fontSize") { (view: ExclusionTextView, size: Double) in
        view.setFontSize(size)
      }

      Prop("lineHeight") { (view: ExclusionTextView, height: Double) in
        view.setLineHeight(height)
      }

      Prop("fontWeight") { (view: ExclusionTextView, weight: Double) in
        view.setFontWeight(weight)
      }

      Prop("selectionColor") { (view: ExclusionTextView, color: UIColor) in
        view.setSelectionColor(color)
      }

      Prop("maxLength") { (view: ExclusionTextView, maxLength: Int) in
        view.setMaxLength(maxLength)
      }

      Prop("photoUri") { (view: ExclusionTextView, uri: String?) in
        view.setPhotoUri(uri)
      }

      Prop("photoWidthFrac") { (view: ExclusionTextView, value: Double) in
        view.setPhotoWidthFrac(value)
      }

      Prop("photoHeightFrac") { (view: ExclusionTextView, value: Double) in
        view.setPhotoHeightFrac(value)
      }

      Prop("exclusionRect") { (view: ExclusionTextView, rect: ExclusionRectRecord?) in
        view.setExclusionRect(rect)
      }

      Prop("exclusionNorm") { (view: ExclusionTextView, rect: ExclusionRectRecord?) in
        view.setExclusionNorm(rect)
      }

      Events("onChangeText", "onFocus", "onBlur", "onSubmitEditing", "onClearPhoto")

      AsyncFunction("focus") { (view: ExclusionTextView) in
        view.focus()
      }

      AsyncFunction("blur") { (view: ExclusionTextView) in
        view.blur()
      }
    }

    View(SelectableChatTextView.self) {
      Prop("text") { (view: SelectableChatTextView, text: String) in
        view.setText(text)
      }

      Prop("color") { (view: SelectableChatTextView, color: UIColor) in
        view.setTextColor(color)
      }

      Prop("fontSize") { (view: SelectableChatTextView, size: Double) in
        view.setFontSize(size)
      }

      Prop("lineHeight") { (view: SelectableChatTextView, height: Double) in
        view.setLineHeight(height)
      }

      Prop("fontWeight") { (view: SelectableChatTextView, weight: Double) in
        view.setFontWeight(weight)
      }

      Prop("selectionColor") { (view: SelectableChatTextView, color: UIColor) in
        view.setSelectionColor(color)
      }

      Prop("numberOfLines") { (view: SelectableChatTextView, lines: Int) in
        view.setNumberOfLines(lines)
      }

      Events("onSelectionChange", "onContentSize")
    }
  }
}
