@Entry
@Component
struct Index {
  @State message: string = 'Welcome to Shining ACG App';
  @State counter: number = 0;

  build() {
    Column() {
      Text(this.message)
        .fontSize(32)
        .fontWeight(FontWeight.Bold)
        .fontColor('#FF3E00')
        .margin({ bottom: 20 })

      Text(`Count: ${this.counter}`)
        .fontSize(24)
        .margin({ bottom: 20 })

      Button('Increment')
        .fontSize(20)
        .width(200)
        .height(50)
        .backgroundColor('#FF3E00')
        .onClick(() => {
          this.counter++;
        })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor('#F9F9F9')
  }
}
