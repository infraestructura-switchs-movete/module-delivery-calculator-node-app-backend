// rollup.config.js

export default {
  input: 'src/app.js', // Usa el archivo JavaScript en lugar de TypeScript
  output: {
    file: 'dist/app.js',
    format: 'esm', // Output en formato ES Module
  },
  onwarn: (warning) => {
    if (warning.code === 'UNRESOLVED_IMPORT') return; // Ignorar ciertos tipos de advertencias
  },
  plugins: [] // No es necesario ningún plugin si no estás usando TypeScript
};
