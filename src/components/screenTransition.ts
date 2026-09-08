export const SECONDARY_SCREEN_TRANSITION_DURATION = 240;

const TRANSITION_END_FRAME_BUFFER = 16;
const pendingTasks = new Set<() => void>();

export function completeSecondaryScreenTransition(): void {
  for (const run of [...pendingTasks]) run();
}

export function scheduleAfterSecondaryTransition(
  callback: () => void,
  animationEnabled: boolean,
): () => void {
  if (!animationEnabled) {
    callback();
    return () => undefined;
  }

  let active = true;
  const run = () => {
    if (!active) return;
    active = false;
    clearTimeout(timeout);
    pendingTasks.delete(run);
    callback();
  };
  const timeout = setTimeout(run, SECONDARY_SCREEN_TRANSITION_DURATION + TRANSITION_END_FRAME_BUFFER);
  pendingTasks.add(run);

  return () => {
    active = false;
    clearTimeout(timeout);
    pendingTasks.delete(run);
  };
}
