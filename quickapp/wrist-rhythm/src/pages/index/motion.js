import sensor from '@system.sensor';

export function subscribeAccelerometer(onSample, onError) {
  try {
    sensor.subscribeAccelerometer({
      interval: 'game',
      callback: (sample) => {
        onSample(sample && { x: sample.x, y: sample.y, z: sample.z });
      },
      fail: (message, code) => {
        if (onError) onError({ message, code });
      },
    });
  } catch (error) {
    if (onError) onError({ message: error.message, code: 200 });
  }
}

export function unsubscribeAccelerometer() {
  try {
    sensor.unsubscribeAccelerometer();
  } catch (error) {
    console.log('取消加速度订阅失败', error.message);
  }
}
