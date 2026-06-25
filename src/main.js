import { rebuild, SK, root } from './character/skeleton.js';
import { animPose, resetPose } from './animation/poses.js';
import { renderer, cam, scene } from './renderer/scene.js';
import { renderOutputs } from './renderer/pixelOutput.js';
import { state } from './state.js';
import './ui/controls.js';
import { updateSkeleton, captureDefaults } from './ui/poseEditor.js';
import { init as launcherInit } from './ui/launcher.js';
import { showLauncher } from './ui/screenManager.js';

let frameCount = 0;
function loop() {
  requestAnimationFrame(loop);
  if (state.playing) { state.tick += 0.016; animPose(state.tick % 1, SK, root); }
  updateSkeleton();
  renderer.render(scene, cam);
  frameCount++;
  if (frameCount % 3 === 0) renderOutputs();
}

rebuild();
resetPose(SK, root);
captureDefaults();
showLauncher();
launcherInit().catch(console.error);
loop();
