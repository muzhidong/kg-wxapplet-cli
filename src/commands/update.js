const inquirer = require('inquirer');
const autocomplete = require('inquirer-autocomplete-prompt');
const ora = require('ora');

const {
  promptPromise,
  handleException,
  execCmd,
} = require('../helper');

const openDB = require('../db/dao');

const {
  checkConfigPath
} = require('../db/db.util.js');

const {
  template,
  component,
} = require('../config/options');

const {
  COMPONENT_PATH_PREFIX,
} = require('../config/constant');

const {
  TYPES,
  selectType,

  updateTpl,
  updateComponent,
  modifyName,
  modifyDesc,
  modifyClass,
  updateSrcPath,
} = require('../config/questions');

let tplData;
let componentData;

async function init() {

  inquirer.registerPrompt('autocomplete', autocomplete);

  let res = await openDB.query();
  if (res.state === 'success') {
    let data = res.data;

    tplData = data.filter(item => {
      return item.type === 'template'
    });
    updateTpl.source = function(answersSoFar, input) {
      let tpl = tplData.filter(item => item.name.search(input) > -1);
      return Promise.resolve(tpl);
    };

    componentData = data.filter(item => {
      return item.type === 'component'
    });
    updateComponent.source = function(answersSoFar, input) {
      let component = componentData.filter(item => item.name.search(input) > -1);
      return Promise.resolve(component);
    };

  } else {
    handleException(res.err);
  }
}

async function updateData(params) {

  let {
    updateTpl,
    updateComponent,
    modifyName,

    modifyClass,

    modifyDesc,

    updateSrcPath,

    scene,
    spinner,
    outLink = false,
  } = params;

  let data = {
    name: modifyName || updateTpl || updateComponent,
    path: `${outLink? updateSrcPath: `${scene === 1? '' : `${COMPONENT_PATH_PREFIX}/`}${modifyName || updateTpl || updateComponent}`}`,
  };
  if (modifyClass) {
    data.class = modifyClass;
  }
  if (modifyDesc) {
    data.desc = modifyDesc;
  }

  let res = await openDB.update({
    name: updateTpl || updateComponent,
    type: scene === 1 ? 'template' : 'component',
  }, {
    $set: data,
  });

  if (res.state === 'success') {
    spinner.succeed('????????????');
  } else {
    spinner.fail('????????????');
    handleException(res.err);
  }
}

async function rename(params) {

  let {
    updateTpl,
    updateComponent,
    modifyName,
    modifyClass,
    modifyDesc,
    updateSrcPath,

    updateTargetPath,

    scene,
    spinner
  } = params;

  // ??????????????????
  let updateSrcName = updateSrcPath.split('/');
  updateSrcName = updateSrcName[updateSrcName.length - 1];

  // ???????????????
  let originName = updateTpl || updateComponent;

  if ((modifyName !== '' && updateSrcName !== modifyName) || (modifyName === '' && updateSrcName !== originName)) {
    // ????????????????????????????????????????????????????????????????????????????????????
    // ????????????????????????????????????????????????????????????????????????????????????
    let path = `${updateTargetPath}${updateTpl? '':`/${COMPONENT_PATH_PREFIX}`}`;
    let current = `${path}/${updateSrcName}`;
    let update = `${path}/${modifyName || originName}`;

    execCmd(`mv ${current} ${update}`, updateData, {
      updateTpl,
      updateComponent,
      modifyName,
      modifyClass,
      modifyDesc,
      scene,
      spinner
    });
  } else {
    updateData({
      updateTpl,
      updateComponent,
      modifyName,
      modifyClass,
      modifyDesc,
      scene,
      spinner
    });
  }
}

async function execUpdateAction(scene) {

  let result = await checkConfigPath(scene);
  if (!result) {
    console.log(chalk.yellow(`????????????${scene === 1?'????????????':'?????????'}???????????????`));
    return;
  }

  let arr = scene === 1 ? [updateTpl, modifyName, ] : [updateComponent, modifyName, modifyClass, ]
  let res = await promptPromise([...arr, modifyDesc, updateSrcPath]);
  if (res.state === 'success') {
    let {
      updateTpl,
      updateComponent,
      modifyName,
      modifyClass,
      modifyDesc,
      updateSrcPath,
    } = res.data;

    if (res.state === 'success') {

      let spinner = ora({
        text: `???????????????????????????...\r\n`,
        color: 'yellow',
      }).start();

      if (!/^http(s)?:\/\//g.test(updateSrcPath)) {
        // ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
        execCmd(`rm -rf ${scene === 1 ? `${result.path}/${updateTpl}` : `${result.path}/${COMPONENT_PATH_PREFIX}/${updateComponent}`} && cp -rf ${updateSrcPath} ${result.path}${scene === 1? '':`/${COMPONENT_PATH_PREFIX}`}`, rename, {
          updateTpl,
          updateComponent,
          modifyName,
          modifyClass,
          modifyDesc,
          updateSrcPath,
          updateTargetPath: result.path,
          scene,
          spinner
        });
      } else {
        updateData({
          updateTpl,
          updateComponent,
          modifyName,
          modifyClass,
          modifyDesc,
          updateSrcPath,
          scene,
          spinner,
          outLink: true,
        });
      }

    } else {
      handleException(res.err);
    }

  } else {
    handleException(res.err);
  }
}

async function handleUpdateAction(opt) {

  await init();

  let {
    component = false,
      template = false,
  } = opt;

  if (component && !template) {
    execUpdateAction(2);
    return;
  }

  if (!component && template) {
    execUpdateAction(1);
    return;
  }

  let res = await promptPromise([selectType]);
  if (res.state === 'success') {
    let scene = res.data.type === TYPES[0] ? 1 : 2;
    execUpdateAction(scene);
  } else {
    handleException(res.err);
  }

}

module.exports = {
  cmd: "update",
  alias: "up",
  desc: "???????????????????????????",
  action: [{
      option: [template.name, template.desc],
    },
    {
      option: [component.name, component.desc],
      action: function(opt) {
        handleUpdateAction(opt);
      },
    }
  ],
}
