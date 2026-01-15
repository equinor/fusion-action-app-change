const core = require('@actions/core')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

async function run() {
  try {
    core.info('🔍 Detecting changed Fusion apps...')
    
    // Get inputs with smart defaults
    const appPaths = core.getInput('app-paths') || 'apps/*'
    const baseRef = getBaseRef()
    
    core.info(`📂 App patterns: ${appPaths}`)
    core.info(`🔄 Comparing against: ${baseRef}`)
    
    // Parse app patterns
    let appPatterns = []
    if (appPaths.startsWith('[') && appPaths.endsWith(']')) {
      appPatterns = JSON.parse(appPaths)
    } else {
      appPatterns = [appPaths]
    }
    
    // Get changed files
    const changedFiles = getChangedFiles(baseRef)
    core.info(`📁 Found ${changedFiles.length} changed files`)
    
    // Find all Fusion apps
    const allApps = findFusionApps(appPatterns)
    core.info(`🎯 Found ${allApps.length} Fusion apps`)
    
    // Determine changed apps
    const changedApps = findChangedApps(changedFiles, allApps)
    core.info(`📦 ${changedApps.length} apps changed`)
    
    // Set outputs
    setOutputs(changedApps)
    
    // Log results
    if (changedApps.length > 0) {
      core.info('📋 Changed apps:')
      for (const app of changedApps) {
        core.info(`  ✓ ${app.name} at ${app.path}`)
      }
    } else {
      core.info('✨ No Fusion apps changed')
    }
    
    core.info('✅ Detection completed')
    
  } catch (error) {
    core.setFailed(`❌ Detection failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function getBaseRef() {
  // Smart base ref detection based on event type
  const eventName = process.env.GITHUB_EVENT_NAME
  
  if (eventName === 'pull_request') {
    try {
      const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      return event.pull_request?.base?.sha || 'main'
    } catch {
      return 'main'
    }
  }
  
  return 'HEAD~1'
}

function getChangedFiles(baseRef) {
  try {
    // Try different git diff approaches
    const commands = [
      `git diff --name-only ${baseRef}...HEAD`,
      `git diff --name-only ${baseRef} HEAD`,
      `git diff --name-only HEAD~1 HEAD`
    ]
    
    for (const cmd of commands) {
      try {
        const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        const files = output.split('\n').filter(file => file.trim())
        if (files.length > 0) {
          return files
        }
      } catch {
        continue
      }
    }
    
    core.warning('⚠️ Could not determine changed files, assuming all apps may be affected')
    return ['**/*']
  } catch (error) {
    core.warning(`⚠️ Git diff failed: ${error.message}`)
    return ['**/*']
  }
}

function findFusionApps(patterns) {
  const apps = []
  
  for (const pattern of patterns) {
    try {
      // Handle different pattern formats
      let searchDirs = []
      
      if (pattern.includes('*')) {
        // Glob pattern like "apps/*"
        const basePath = pattern.replace('/*', '')
        if (fs.existsSync(basePath) && fs.lstatSync(basePath).isDirectory()) {
          const entries = fs.readdirSync(basePath)
          searchDirs = entries
            .map(entry => path.join(basePath, entry))
            .filter(dirPath => fs.lstatSync(dirPath).isDirectory())
        }
      } else {
        // Direct path
        if (fs.existsSync(pattern) && fs.lstatSync(pattern).isDirectory()) {
          searchDirs = [pattern]
        }
      }
      
      // Check each directory for Fusion apps
      for (const dir of searchDirs) {
        const packageJsonPath = path.join(dir, 'package.json')
        
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
            
            if (isFusionApp(packageJson)) {
              apps.push({
                name: packageJson.name || path.basename(dir),
                path: dir
              })
            }
          } catch (parseError) {
            core.warning(`⚠️ Could not parse ${packageJsonPath}: ${parseError.message}`)
          }
        }
      }
    } catch (patternError) {
      core.warning(`⚠️ Pattern ${pattern} failed: ${patternError.message}`)
    }
  }
  
  return apps
}

function isFusionApp(packageJson) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  }
  
  // Must have Fusion dependencies
  const hasFusionDeps = Object.keys(allDeps).some(dep => 
    dep.startsWith('@equinor/fusion')
  )
  
  if (!hasFusionDeps) return false
  
  // Strong indicators it's an app (not library)
  const hasCli = !!allDeps['@equinor/fusion-framework-cli']
  const scripts = packageJson.scripts || {}
  const hasAppScripts = Object.keys(scripts).some(script => 
    script.includes('build') || 
    script.includes('start') ||
    (scripts[script] || '').includes('fusion-framework-cli') ||
    (scripts[script] || '').includes('ffc')
  )
  const hasAppConfig = !!(packageJson.fusion || packageJson.fusionApp)
  
  // Exclude clear libraries
  const isLibrary = !!(packageJson.main || packageJson.module || packageJson.exports)
  const isPublishable = !packageJson.private && isLibrary
  
  if (isPublishable && !hasAppScripts && !hasAppConfig) {
    return false
  }
  
  return hasCli || hasAppScripts || hasAppConfig || packageJson.private
}

function findChangedApps(changedFiles, allApps) {
  const changedApps = []
  
  for (const app of allApps) {
    const isChanged = changedFiles.some(file => {
      const normalizedFile = file.startsWith('./') ? file.slice(2) : file
      const normalizedAppPath = app.path.startsWith('./') ? app.path.slice(2) : app.path
      
      return normalizedFile.startsWith(normalizedAppPath + '/') || 
             normalizedFile === normalizedAppPath ||
             file === '**/*' // Fallback case
    })
    
    if (isChanged) {
      changedApps.push(app)
    }
  }
  
  return changedApps
}

function setOutputs(changedApps) {
  const appNames = changedApps.map(app => app.name)
  const hasChanges = changedApps.length > 0
  
  // Create matrix for GitHub Actions
  const matrix = {
    include: changedApps.map(app => ({
      name: app.name,
      path: app.path
    }))
  }
  
  // Set all outputs
  core.setOutput('changed-apps', JSON.stringify(changedApps))
  core.setOutput('changed-app-names', appNames.join(','))
  core.setOutput('has-changes', hasChanges.toString())
  core.setOutput('matrix', JSON.stringify(matrix))
  core.setOutput('changed-apps-count', changedApps.length.toString())
}

// Run the action
if (require.main === module) {
  run()
}

module.exports = { 
  run,
  // Export internal functions for testing
  getBaseRef,
  getChangedFiles,
  findFusionApps,
  isFusionApp,
  findChangedApps,
  setOutputs
}