import {
  SECONDARY_SCREEN_TRANSITION_DURATION,
  completeSecondaryScreenTransition,
  scheduleAfterSecondaryTransition,
} from './screenTransition';

describe('scheduleAfterSecondaryTransition', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs immediately when the transition is not animated', () => {
    const callback = jest.fn();

    scheduleAfterSecondaryTransition(callback, false);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('waits until the animated transition and its final frame are complete', () => {
    jest.useFakeTimers();
    const callback = jest.fn();

    scheduleAfterSecondaryTransition(callback, true);
    jest.advanceTimersByTime(SECONDARY_SCREEN_TRANSITION_DURATION);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(16);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('runs pending work when the navigator reports the transition end', () => {
    jest.useFakeTimers();
    const callback = jest.fn();

    scheduleAfterSecondaryTransition(callback, true);
    completeSecondaryScreenTransition();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancels pending work when the screen loses focus', () => {
    jest.useFakeTimers();
    const callback = jest.fn();

    const cancel = scheduleAfterSecondaryTransition(callback, true);
    cancel();
    jest.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });
});
