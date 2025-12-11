import Ability from '@ohos.app.ability.UIAbility';
import Window from '@ohos.window';

export default class MainAbility extends Ability {
  onCreate(want, launchParam) {
    console.info('[MainAbility] onCreate');
  }

  onDestroy() {
    console.info('[MainAbility] onDestroy');
  }

  onWindowStageCreate(windowStage: Window.WindowStage) {
    console.info('[MainAbility] onWindowStageCreate');
    windowStage.loadContent('pages/Index', (err, data) => {
      if (err.code) {
        console.error(
          `Failed to load the content. Code: ${err.code}, message: ${err.message}`
        );
        return;
      }
      console.info(
        'Succeeded in loading the content. Data: ' + JSON.stringify(data)
      );
    });
  }

  onWindowStageDestroy() {
    console.info('[MainAbility] onWindowStageDestroy');
  }

  onForeground() {
    console.info('[MainAbility] onForeground');
  }

  onBackground() {
    console.info('[MainAbility] onBackground');
  }
}
