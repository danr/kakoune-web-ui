module.exports = {
  ...require('@snowpack/app-scripts-react/jest.config.js')(),
  setupFilesAfterEnv: [],
  clearMocks: true,
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*)(spec|test).[tj]s?(x)'],
  forceCoverageMatch: ['**/*doctest*'],
  testEnvironment: 'jest-environment-jsdom',
  snapshotSerializers: ['jest-emotion'],
  moduleNameMapper: {
    '@app/(.*)': ['<rootDir>/src/$1'],
  },
}
