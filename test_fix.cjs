const { getProjects } = require('./services/dataService.ts');

getProjects().then(projects => {
  console.log('✅ getProjects() works!');
  console.log(`Found ${projects.length} projects`);
  if (projects.length > 0) {
    console.log('Sample project:', {
      id: projects[0].id,
      projectCode: projects[0].projectCode,
      customerName: projects[0].customerName,
      customerId: projects[0].customerId
    });
  }
}).catch(error => {
  console.log('❌ getProjects() failed:', error.message);
});
