import ExpoModulesCore
import UIKit

/// UITextView + фото-«марка»: текст обтекает фото слева, затем на всю ширину снизу.
final class ExclusionTextView: ExpoView, UITextViewDelegate {
  private let textView = UITextView()
  private let photoView = UIImageView()
  private let clearButton = UIButton(type: .system)
  private var maxLength = 400
  private var isSettingText = false
  private var photoUri: String?
  private var photoWidthFrac: CGFloat = 0.2
  private var photoHeightFrac: CGFloat = 0.26
  private var fontSize: CGFloat = 13
  private var lineHeight: CGFloat = 17
  private var fontWeightValue: Double = 500
  private var textColorValue: UIColor = UIColor(red: 1, green: 0.35, blue: 0.35, alpha: 1)
  /// Красный курсор ввода — отдельно от цвета текста (Shanghai LCD).
  private var cursorColorValue: UIColor = UIColor(red: 1, green: 0.23, blue: 0.19, alpha: 1)
  private var photoLoadToken = UUID()

  let onChangeText = EventDispatcher()
  let onFocus = EventDispatcher()
  let onBlur = EventDispatcher()
  let onSubmitEditing = EventDispatcher()
  let onClearPhoto = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    clipsToBounds = true

    textView.delegate = self
    textView.backgroundColor = .clear
    textView.textContainerInset = UIEdgeInsets(top: 4, left: 10, bottom: 8, right: 6)
    textView.textContainer.lineFragmentPadding = 0
    textView.textContainer.widthTracksTextView = true
    textView.textContainer.heightTracksTextView = false
    textView.isScrollEnabled = true
    textView.alwaysBounceVertical = false
    textView.showsVerticalScrollIndicator = false
    textView.showsHorizontalScrollIndicator = false
    textView.autocorrectionType = .default
    textView.autocapitalizationType = .sentences
    textView.keyboardAppearance = .dark
    textView.returnKeyType = .go
    textView.tintColor = cursorColorValue
    textView.textColor = textColorValue
    textView.layoutManager.allowsNonContiguousLayout = false
    textView.translatesAutoresizingMaskIntoConstraints = true
    textView.clipsToBounds = true
    if #available(iOS 11.0, *) {
      textView.contentInsetAdjustmentBehavior = .never
    }
    textView.setContentHuggingPriority(.defaultLow, for: .vertical)
    textView.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
    applyScrollPadding()

    photoView.contentMode = .scaleAspectFill
    photoView.clipsToBounds = true
    photoView.layer.cornerRadius = 5
    photoView.layer.borderWidth = 1
    photoView.layer.borderColor = UIColor(red: 1, green: 0.36, blue: 0.36, alpha: 0.45).cgColor
    photoView.backgroundColor = UIColor(white: 0.18, alpha: 1)
    photoView.isHidden = true
    photoView.isUserInteractionEnabled = true

    clearButton.setTitle("×", for: .normal)
    clearButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
    clearButton.setTitleColor(textColorValue, for: .normal)
    clearButton.backgroundColor = UIColor(white: 0, alpha: 0.55)
    clearButton.layer.cornerRadius = 3
    clearButton.isHidden = true
    clearButton.addTarget(self, action: #selector(clearPhotoTapped), for: .touchUpInside)

    addSubview(textView)
    addSubview(photoView)
    addSubview(clearButton)
    applyTypography()
  }

  override var intrinsicContentSize: CGSize {
    CGSize(width: UIView.noIntrinsicMetric, height: UIView.noIntrinsicMetric)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    layoutStamp()
    scrollCaretIntoView(force: false)
  }

  func setText(_ text: String) {
    guard textView.text != text else {
      scrollCaretIntoView(force: true)
      return
    }

    isSettingText = true
    let selected = textView.selectedRange
    textView.text = text
    if let font = textView.font {
      textView.typingAttributes = typingAttrs(font: font)
    }
    let end = (text as NSString).length
    textView.selectedRange = NSRange(location: min(max(selected.location, 0), end), length: 0)
    isSettingText = false
    layoutStamp()
    scrollCaretIntoView(force: true)
  }

  func setPlaceholder(_ placeholder: String) {}

  func setTextColor(_ color: UIColor) {
    textColorValue = color
    textView.textColor = color
    textView.tintColor = cursorColorValue
    clearButton.setTitleColor(color, for: .normal)
    photoView.layer.borderColor = color.withAlphaComponent(0.45).cgColor
    if let font = textView.font {
      textView.typingAttributes = typingAttrs(font: font)
    }
  }

  func setPlaceholderColor(_ color: UIColor) {}

  func setFontSize(_ size: Double) {
    fontSize = CGFloat(size)
    applyTypography()
  }

  func setLineHeight(_ height: Double) {
    lineHeight = CGFloat(height)
    applyTypography()
  }

  func setFontWeight(_ weight: Double) {
    fontWeightValue = weight
    applyTypography()
  }

  func setSelectionColor(_ color: UIColor) {
    // selection highlight only; caret stays accent red
    _ = color
  }

  func setCursorColor(_ color: UIColor) {
    cursorColorValue = color
    textView.tintColor = color
  }

  func setMaxLength(_ maxLength: Int) {
    self.maxLength = maxLength
  }

  func setPhotoUri(_ uri: String?) {
    let trimmed = uri?.trimmingCharacters(in: .whitespacesAndNewlines)
    let next = (trimmed?.isEmpty == false) ? trimmed : nil
    guard next != photoUri else { return }
    photoUri = next
    reloadPhoto()
    setNeedsLayout()
  }

  func setPhotoWidthFrac(_ value: Double) {
    photoWidthFrac = min(0.28, max(0.12, CGFloat(value)))
    setNeedsLayout()
  }

  func setPhotoHeightFrac(_ value: Double) {
    photoHeightFrac = min(0.36, max(0.14, CGFloat(value)))
    setNeedsLayout()
  }

  func setExclusionRect(_ rect: ExclusionRectRecord?) {}
  func setExclusionNorm(_ rect: ExclusionRectRecord?) {}

  func focus() {
    textView.becomeFirstResponder()
  }

  func blur() {
    textView.resignFirstResponder()
  }

  @objc private func clearPhotoTapped() {
    onClearPhoto([:])
  }

  private func applyScrollPadding() {
    // Только зазор под кнопку «+». Большой inset скроллил текст уже со 2-й строки.
    textView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: 14, right: 0)
    textView.scrollIndicatorInsets = textView.contentInset
  }

  private func reloadPhoto() {
    photoLoadToken = UUID()
    photoView.isHidden = true
    photoView.image = nil
    clearButton.isHidden = true
    guard photoUri != nil else {
      textView.textContainer.exclusionPaths = []
      return
    }
  }

  private static func loadImage(from uri: String) -> UIImage? {
    let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return nil }

    if trimmed.hasPrefix("data:"), let comma = trimmed.firstIndex(of: ",") {
      let b64 = String(trimmed[trimmed.index(after: comma)...])
      if let data = Data(base64Encoded: b64) { return UIImage(data: data) }
    }

    var candidates: [URL] = []
    if let url = URL(string: trimmed) {
      candidates.append(url)
    }
    if trimmed.hasPrefix("file:"), let encoded = trimmed.removingPercentEncoding {
      candidates.append(URL(fileURLWithPath: encoded.replacingOccurrences(of: "file://", with: "")))
    }
    if trimmed.hasPrefix("/") {
      candidates.append(URL(fileURLWithPath: trimmed))
      if let decoded = trimmed.removingPercentEncoding {
        candidates.append(URL(fileURLWithPath: decoded))
      }
    }
    if trimmed.hasPrefix("file:"), let url = URL(string: trimmed) {
      candidates.append(URL(fileURLWithPath: url.path))
    }

    for url in candidates {
      let path = url.path
      if let img = UIImage(contentsOfFile: path) { return img }
      if let decoded = path.removingPercentEncoding, let img = UIImage(contentsOfFile: decoded) { return img }
      if let data = try? Data(contentsOf: url), let img = UIImage(data: data) { return img }
    }

    return nil
  }

  private func typingAttrs(font: UIFont) -> [NSAttributedString.Key: Any] {
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = lineHeight
    paragraph.maximumLineHeight = lineHeight
    paragraph.lineBreakMode = .byCharWrapping
    return [
      .font: font,
      .paragraphStyle: paragraph,
      .foregroundColor: textColorValue,
    ]
  }

  private func resolveFont() -> UIFont {
    let weight = weightToUIFontWeight(fontWeightValue)
    let base = UIFont.systemFont(ofSize: fontSize, weight: weight)
    // SF Rounded — заметно «Apple digital», не обычный System/serif
    if let rounded = base.fontDescriptor.withDesign(.rounded) {
      return UIFont(descriptor: rounded, size: fontSize)
    }
    return base
  }

  private func applyTypography() {
    let font = resolveFont()
    textView.font = font
    textView.textColor = textColorValue
    textView.tintColor = cursorColorValue
    textView.typingAttributes = typingAttrs(font: font)
    applyScrollPadding()
  }

  /// Марка в правом верхнем углу + exclusion ровно по её frame.
  private func layoutStamp() {
    guard bounds.width > 16, bounds.height > 16 else { return }

    let inset = textView.textContainerInset
    let containerW = max(1, bounds.width - inset.left - inset.right)

    guard photoUri != nil else {
      photoView.isHidden = true
      clearButton.isHidden = true
      textView.textContainer.exclusionPaths = []
      textView.textContainer.size = CGSize(width: containerW, height: .greatestFiniteMagnitude)
      return
    }

    // Пиксели рисует expo-image. Native UIImageView здесь только даёт чёрный прямоугольник.
    photoView.isHidden = true
    photoView.image = nil
    clearButton.isHidden = true

    let marginTop: CGFloat = 4
    let marginRight: CGFloat = 12
    let photoW = max(52, min(round(bounds.width * photoWidthFrac), bounds.width * 0.26))
    let photoH = max(64, min(round(bounds.height * photoHeightFrac), bounds.height * 0.32))
    let photoX = bounds.width - marginRight - photoW
    let photoY = marginTop

    // Обтекание ~5 строк слева, даже если сама марка ниже — потом текст на всю ширину
    let wrapH = lineHeight * 5 + 8
    var exclusion = CGRect(
      x: photoX - inset.left,
      y: photoY - inset.top,
      width: photoW + marginRight + 2,
      height: max(photoH + 4, wrapH)
    )
    exclusion.origin.x = max(0, exclusion.origin.x - 4)
    exclusion.origin.y = max(0, exclusion.origin.y)
    exclusion.size.width = max(exclusion.width, containerW - exclusion.origin.x + 2)

    textView.textContainer.exclusionPaths = [UIBezierPath(roundedRect: exclusion, cornerRadius: 4)]
    textView.textContainer.size = CGSize(width: containerW, height: .greatestFiniteMagnitude)
    textView.layoutManager.invalidateLayout(
      forCharacterRange: NSRange(location: 0, length: textView.textStorage.length),
      actualCharacterRange: nil
    )
    textView.layoutManager.ensureLayout(for: textView.textContainer)
  }

  /// Скролл только когда каретка реально уехала за низ CRT (~после 5 строк), не со 2-й.
  private func scrollCaretIntoView(force: Bool) {
    textView.isScrollEnabled = true
    applyScrollPadding()
    textView.layoutManager.ensureLayout(for: textView.textContainer)

    let boundsH = textView.bounds.height
    guard boundsH > 8 else { return }

    let extra = textView.contentInset.bottom
    let inset = textView.textContainerInset
    let used = textView.layoutManager.usedRect(for: textView.textContainer)
    let contentH = ceil(used.maxY + inset.top + inset.bottom)
    let maxOffset = max(0, contentH + extra - boundsH)

    if contentH <= boundsH - 4 {
      if textView.contentOffset.y != 0 {
        textView.setContentOffset(.zero, animated: false)
      }
      return
    }

    var caret = CGRect.null
    if let range = textView.selectedTextRange {
      caret = textView.caretRect(for: range.end)
    }

    var target = textView.contentOffset.y
    if caret.isNull || caret.origin.y.isInfinite || caret.origin.y.isNaN || caret.height < 1 {
      target = maxOffset
    } else {
      let pad: CGFloat = 4
      let visibleBottom = target + boundsH - extra - pad
      if caret.maxY > visibleBottom {
        target = caret.maxY - boundsH + extra + pad
      } else if caret.minY < target + inset.top {
        target = caret.minY - inset.top
      }
    }

    target = min(max(0, target), maxOffset)
    if force || abs(target - textView.contentOffset.y) > 0.5 {
      textView.setContentOffset(CGPoint(x: 0, y: target), animated: false)
    }
  }

  private func weightToUIFontWeight(_ value: Double) -> UIFont.Weight {
    switch value {
    case ..<300: return .ultraLight
    case ..<400: return .light
    case ..<500: return .regular
    case ..<600: return .medium
    case ..<700: return .semibold
    case ..<800: return .bold
    default: return .heavy
    }
  }

  func textViewDidChange(_ textView: UITextView) {
    guard !isSettingText else { return }

    var next = textView.text ?? ""
    if next.count > maxLength {
      next = String(next.prefix(maxLength))
      isSettingText = true
      textView.text = next
      isSettingText = false
    }

    scrollCaretIntoView(force: true)
    onChangeText(["text": next])
    DispatchQueue.main.async { [weak self] in
      self?.scrollCaretIntoView(force: true)
    }
  }

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    if scrollView.contentOffset.y < 0 {
      scrollView.contentOffset = .zero
    }
  }

  func textViewDidBeginEditing(_ textView: UITextView) {
    textView.tintColor = cursorColorValue
    onFocus([:])
  }

  func textViewDidEndEditing(_ textView: UITextView) {
    onBlur([:])
  }

  func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
    if text == "\n" {
      onSubmitEditing([:])
      textView.resignFirstResponder()
      return false
    }
    return true
  }
}

/// Read-only UITextView: зажатие выделяет слово и шлёт onSelectionChange (плашка перевода).
/// Подсветка своя (золотая плашка) — системные handles у non-editable часто невидимы.
final class SelectableChatTextView: ExpoView, UITextViewDelegate, UIGestureRecognizerDelegate {
  private let textView = UITextView()
  private let highlightView = UIView()
  private var fontSize: CGFloat = 16
  private var lineHeight: CGFloat = 24
  private var fontWeightValue: Double = 600
  private var textColorValue = UIColor(red: 0.10, green: 0.10, blue: 0.10, alpha: 1)
  private var maxLines = 0
  private var lastEmittedHeight: CGFloat = -1
  private var lastSelection = NSRange(location: 0, length: 0)
  private var highlightRange = NSRange(location: NSNotFound, length: 0)
  private let haptic = UIImpactFeedbackGenerator(style: .medium)

  /// Системный синий выделения iOS (как в Notes / Messages).
  private let selectionBlue = UIColor(red: 0.04, green: 0.52, blue: 1.0, alpha: 1)
  private let handleScale: CGFloat = 0.92

  let onSelectionChange = EventDispatcher()
  let onContentSize = EventDispatcher()
  let onInteract = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    clipsToBounds = false

    textView.delegate = self
    textView.backgroundColor = .clear
    textView.isEditable = false
    textView.isSelectable = true
    textView.isScrollEnabled = false
    textView.isUserInteractionEnabled = true
    textView.showsVerticalScrollIndicator = false
    textView.showsHorizontalScrollIndicator = false
    textView.textContainerInset = .zero
    textView.textContainer.lineFragmentPadding = 0
    textView.textContainer.widthTracksTextView = true
    textView.tintColor = selectionBlue
    textView.tintAdjustmentMode = .normal
    textView.keyboardDismissMode = .none
    if #available(iOS 11.0, *) {
      textView.contentInsetAdjustmentBehavior = .never
    }
    textView.translatesAutoresizingMaskIntoConstraints = true
    applyTypography()

    highlightView.isUserInteractionEnabled = false
    highlightView.isHidden = true
    highlightView.backgroundColor = selectionBlue.withAlphaComponent(0.22)
    highlightView.layer.cornerRadius = 5
    highlightView.layer.borderWidth = 0
    highlightView.clipsToBounds = true
    textView.insertSubview(highlightView, at: 0)

    let hold = UILongPressGestureRecognizer(target: self, action: #selector(held))
    hold.minimumPressDuration = 0.38
    hold.allowableMovement = 12
    hold.cancelsTouchesInView = true
    hold.delaysTouchesBegan = false
    hold.delegate = self
    textView.addGestureRecognizer(hold)

    let tap = UITapGestureRecognizer(target: self, action: #selector(tapped))
    tap.cancelsTouchesInView = false
    tap.delegate = self
    textView.addGestureRecognizer(tap)

    addSubview(textView)
    haptic.prepare()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    emitContentSize()
    layoutHighlight()
    polishHandles()
  }

  func setText(_ text: String) {
    if textView.text == text {
      emitContentSize()
      layoutHighlight()
      return
    }
    clearHighlight()
    textView.text = text
    applyTypography()
    emitContentSize()
  }

  func setTextColor(_ color: UIColor) {
    textColorValue = color
    applyTypography()
  }

  func setFontSize(_ size: Double) {
    fontSize = CGFloat(size)
    applyTypography()
  }

  func setLineHeight(_ height: Double) {
    lineHeight = CGFloat(height)
    applyTypography()
  }

  func setFontWeight(_ weight: Double) {
    fontWeightValue = weight
    applyTypography()
  }

  func setSelectionColor(_ color: UIColor) {
    textView.tintColor = color
    highlightView.backgroundColor = color.withAlphaComponent(0.22)
    highlightView.layer.borderWidth = 0
  }

  func setNumberOfLines(_ lines: Int) {
    maxLines = max(0, lines)
    textView.textContainer.maximumNumberOfLines = maxLines
    textView.textContainer.lineBreakMode = maxLines > 0 ? .byTruncatingTail : .byWordWrapping
    emitContentSize()
  }

  func textViewDidChangeSelection(_ textView: UITextView) {
    let range = textView.selectedRange
    lastSelection = range
    let ns = (textView.text ?? "") as NSString
    var selected = ""
    if range.length > 0, NSMaxRange(range) <= ns.length {
      selected = ns.substring(with: range)
        .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
      highlightRange = range
      layoutHighlight()
    } else {
      clearHighlight()
    }
    onSelectionChange([
      "text": selected,
      "start": range.location,
      "end": range.location + range.length,
    ])
    DispatchQueue.main.async { [weak self] in
      self?.layoutHighlight()
      self?.polishHandles()
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
      self?.layoutHighlight()
      self?.polishHandles()
    }
  }

  func textView(
    _ textView: UITextView,
    shouldInteractWith URL: URL,
    in characterRange: NSRange,
    interaction: UITextItemInteraction
  ) -> Bool {
    false
  }

  @available(iOS 16.0, *)
  func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
    nil
  }

  @objc private func held(_ gesture: UILongPressGestureRecognizer) {
    guard gesture.state == .began else { return }
    onInteract([:])
    let point = gesture.location(in: textView)
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.haptic.impactOccurred()
      self.haptic.prepare()
      self.selectWord(at: point)
    }
  }

  @objc private func tapped(_ gesture: UITapGestureRecognizer) {
    guard gesture.state == .ended else { return }
    let point = gesture.location(in: textView)
    // Тап по уже выделенному слову оставляем; мимо — снимаем подсветку и плашку.
    if highlightRange.location != NSNotFound,
       !highlightView.isHidden,
       highlightView.frame.insetBy(dx: -6, dy: -4).contains(point) {
      return
    }
    onInteract([:])
    clearSelection()
  }

  /// Снять подсветку и явно сообщить JS (selectedRange=0 часто не триггерит delegate повторно).
  func clearSelection() {
    clearHighlight()
    lastSelection = NSRange(location: 0, length: 0)
    if textView.selectedRange.length > 0 {
      textView.selectedRange = NSRange(location: 0, length: 0)
    } else {
      onSelectionChange([
        "text": "",
        "start": 0,
        "end": 0,
      ])
    }
    if textView.isFirstResponder {
      textView.resignFirstResponder()
    }
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    false
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    otherGestureRecognizer is UIPanGestureRecognizer
  }

  /// Выделяет слово / CJK-символ под пальцем — иначе haptic есть, а selection не появляется.
  private func selectWord(at point: CGPoint) {
    guard let raw = textView.text, !raw.isEmpty else { return }
    let ns = raw as NSString
    var location = point
    location.x -= textView.textContainerInset.left
    location.y -= textView.textContainerInset.top
    location.x += textView.contentOffset.x
    location.y += textView.contentOffset.y

    var fraction: CGFloat = 0
    let idx = textView.layoutManager.characterIndex(
      for: location,
      in: textView.textContainer,
      fractionOfDistanceBetweenInsertionPoints: &fraction
    )
    guard ns.length > 0 else { return }
    let index = min(max(0, idx), ns.length - 1)
    let range = wordRange(around: index, in: ns)
    guard range.length > 0, NSMaxRange(range) <= ns.length else { return }

    // Без first responder системная подсветка часто не рисуется — держим свою + selection.
    _ = textView.becomeFirstResponder()
    highlightRange = range
    textView.selectedRange = range
    layoutHighlight()
    polishHandles()
  }

  private func clearHighlight() {
    highlightRange = NSRange(location: NSNotFound, length: 0)
    highlightView.isHidden = true
    highlightView.frame = .zero
  }

  private func layoutHighlight() {
    guard highlightRange.location != NSNotFound, highlightRange.length > 0 else {
      highlightView.isHidden = true
      return
    }
    let nsLen = ((textView.text ?? "") as NSString).length
    guard NSMaxRange(highlightRange) <= nsLen else {
      clearHighlight()
      return
    }

    textView.layoutManager.ensureLayout(for: textView.textContainer)
    let glyphRange = textView.layoutManager.glyphRange(forCharacterRange: highlightRange, actualCharacterRange: nil)
    var union = CGRect.null
    textView.layoutManager.enumerateEnclosingRects(
      forGlyphRange: glyphRange,
      withinSelectedGlyphRange: glyphRange,
      in: textView.textContainer
    ) { rect, _ in
      union = union.isNull ? rect : union.union(rect)
    }
    guard !union.isNull, union.width > 0, union.height > 0 else {
      highlightView.isHidden = true
      return
    }

    let inset = textView.textContainerInset
    var frame = union.insetBy(dx: -3, dy: -2)
    frame.origin.x += inset.left
    frame.origin.y += inset.top
    // Не даём плашке уехать за края строки.
    frame.origin.x = max(0, frame.origin.x)
    frame.size.width = min(frame.width, textView.bounds.width - frame.origin.x)

    highlightView.frame = frame
    highlightView.isHidden = false
    textView.sendSubviewToBack(highlightView)
  }

  private func wordRange(around index: Int, in ns: NSString) -> NSRange {
    var found = NSRange(location: NSNotFound, length: 0)
    ns.enumerateSubstrings(
      in: NSRange(location: 0, length: ns.length),
      options: [.byWords, .localized]
    ) { _, substringRange, _, stop in
      if NSLocationInRange(index, substringRange) {
        found = substringRange
        stop.pointee = true
      }
    }
    if found.location != NSNotFound, found.length > 0 {
      return found
    }

    // CJK / punctuation: одна grapheme-cluster под пальцем.
    let composed = ns.rangeOfComposedCharacterSequence(at: index)
    if composed.length > 0 {
      let ch = ns.substring(with: composed)
      if ch.rangeOfCharacter(from: .whitespacesAndNewlines) == nil {
        return composed
      }
    }

    // Latin fallback с апострофами (don't, l'eau).
    var start = index
    var end = index
    while start > 0 {
      let prev = ns.rangeOfComposedCharacterSequence(at: start - 1)
      let piece = ns.substring(with: prev)
      if isWordPiece(piece) {
        start = prev.location
      } else {
        break
      }
    }
    while end < ns.length {
      let next = ns.rangeOfComposedCharacterSequence(at: end)
      let piece = ns.substring(with: next)
      if isWordPiece(piece) {
        end = NSMaxRange(next)
      } else {
        break
      }
    }
    return end > start ? NSRange(location: start, length: end - start) : composed
  }

  private func isWordPiece(_ s: String) -> Bool {
    guard !s.isEmpty else { return false }
    if s.rangeOfCharacter(from: .whitespacesAndNewlines) != nil { return false }
    if s.rangeOfCharacter(from: .letters) != nil { return true }
    if s.rangeOfCharacter(from: .decimalDigits) != nil { return true }
    if s == "'" || s == "\u{2019}" || s == "-" { return true }
    // Han / kana / hangul
    for scalar in s.unicodeScalars {
      switch scalar.value {
      case 0x3400...0x9FFF, 0xF900...0xFAFF, 0x3040...0x30FF, 0xAC00...0xD7AF, 0x1100...0x11FF:
        return true
      default:
        continue
      }
    }
    return false
  }

  private func applyTypography() {
    let weight = weightToUIFontWeight(fontWeightValue)
    let font = UIFont.systemFont(ofSize: fontSize, weight: weight)
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = lineHeight
    paragraph.maximumLineHeight = lineHeight
    paragraph.lineBreakMode = maxLines > 0 ? .byTruncatingTail : .byWordWrapping
    textView.font = font
    textView.textColor = textColorValue
    textView.typingAttributes = [
      .font: font,
      .foregroundColor: textColorValue,
      .paragraphStyle: paragraph,
    ]
    if let current = textView.text, !current.isEmpty {
      textView.attributedText = NSAttributedString(string: current, attributes: [
        .font: font,
        .foregroundColor: textColorValue,
        .paragraphStyle: paragraph,
      ])
    }
    layoutHighlight()
  }

  private func emitContentSize() {
    let width = bounds.width > 8 ? bounds.width : UIScreen.main.bounds.width - 48
    textView.frame.size.width = width
    let fitted = textView.sizeThatFits(CGSize(width: width, height: CGFloat.greatestFiniteMagnitude))
    let height = ceil(fitted.height)
    if abs(height - lastEmittedHeight) < 0.5 { return }
    lastEmittedHeight = height
    onContentSize(["width": Double(width), "height": Double(height)])
  }

  private func polishHandles() {
    var roots: [UIView] = [textView]
    if let super1 = textView.superview { roots.append(super1) }
    if let super2 = textView.superview?.superview { roots.append(super2) }
    if let window = textView.window { roots.append(window) }
    for root in roots {
      walkHandles(root, depth: 0)
    }
  }

  private func walkHandles(_ view: UIView, depth: Int) {
    if depth > 10 { return }
    let name = NSStringFromClass(type(of: view))
    if isHandleName(name) {
      styleHandle(view)
    }
    for child in view.subviews {
      walkHandles(child, depth: depth + 1)
    }
  }

  private func isHandleName(_ name: String) -> Bool {
    name.contains("Grabber") || name.contains("SelectionHandle") || name.contains("HandleView")
  }

  private func styleHandle(_ view: UIView) {
    view.transform = CGAffineTransform(scaleX: handleScale, y: handleScale)
    view.tintColor = selectionBlue
    view.alpha = 1
    view.isHidden = false
    if view.bounds.width > 0, view.bounds.width < 40, abs(view.bounds.width - view.bounds.height) < 8 {
      view.backgroundColor = selectionBlue
      view.layer.cornerRadius = min(view.bounds.width, view.bounds.height) / 2
      view.layer.borderWidth = 0
      view.layer.masksToBounds = true
    }
    if let imageView = view as? UIImageView, let image = imageView.image {
      imageView.image = image.withTintColor(selectionBlue, renderingMode: .alwaysOriginal)
    }
    for child in view.subviews {
      child.tintColor = selectionBlue
      child.isHidden = false
      if child.bounds.width > 0, child.bounds.width < 28 {
        child.backgroundColor = selectionBlue
        child.layer.cornerRadius = min(child.bounds.width, child.bounds.height) / 2
        child.layer.borderWidth = 0
        child.layer.masksToBounds = true
      }
    }
  }

  private func weightToUIFontWeight(_ value: Double) -> UIFont.Weight {
    switch value {
    case ..<300: return .ultraLight
    case ..<400: return .light
    case ..<500: return .regular
    case ..<600: return .medium
    case ..<700: return .semibold
    case ..<800: return .bold
    default: return .heavy
    }
  }
}
