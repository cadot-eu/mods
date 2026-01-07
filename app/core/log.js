import path from 'path';

function createLoggerMixin() {
  return function mixin() {
    const stack = new Error().stack;
    const lines = stack.split('\n');
    
    for (const line of lines) {
      if (line.includes('.js') && 
          !line.includes('node_modules') && 
          !line.includes('internal/') &&
          !line.includes('mixin')) {
        const match = line.match(/\((.+):(\d+):(\d+)\)/);
        if (match) {
          return { file: path.basename(match[1], '.js').toUpperCase() };
        }
      }
    }
    return { file: 'INDEX' };
  };
}

export { createLoggerMixin };
