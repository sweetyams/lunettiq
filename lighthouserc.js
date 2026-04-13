module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3000/collections/optics',
        'http://localhost:3000/products/sample-frame',
      ],
      numberOfRuns: 3,
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'ready on',
    },
    assert: { assertions: {} },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
