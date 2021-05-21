// Muxlab KVM

var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions();

	return self;
};

const apiUrl = '/mnc/secure_api.php';

instance.prototype.devices = [];
instance.prototype.devices_list = [ { id: '0', label: '(no devices found)'} ];

/**
 * Config updated by the user.
 */
instance.prototype.updateConfig = function(config) {
	var self = this;
	clearInterval(self.polling);
	self.config = config;
	self.init_connection();
};

/**
 * Initializes the module.
 */
instance.prototype.init = function() {
	var self = this;

	self.init_connection();
};

instance.prototype.init_connection = function() {
	var self = this;
	if ((self.config.username !== '') && (self.config.password !== '') && (self.config.host !== '')) {
		self.get_devices();

		if (self.config.polling) {
			self.polling = setInterval(() => {
				self.get_devices();
			}, 5000);
		}
	}
};

instance.prototype.get_devices = function() {
	let self = this;

	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_userName': self.config.username,
		'p_password': self.config.password,
		'p_cmd': 'get_devices'
	};

	self.postRest(cmd, jsonBody).then(function(result) {
		//process results
		/*
		"p_targetId":<systemID>,
		"p_cmd":"launch_discovery_auto",
		"p_rspStatus":"SUCCESS",
		"p _msg":"<a_message>",
		"p_data":[
			{
				"productName":"<value>",
				"modelName":"<value>",
				"customName":"<value>",
				"mac":"<value>",
				"ip":"<value>",
				"mask":"<value>",
				"isDhcp":<0/1>,
				"multicastGroupIp":"<value>",
				"videoResolution":"<value >",
				"videoFrameRate":"<value>",
				"audioFormat":"<value>",
				"isVideoSignalDetected":<0/1>,
				"isIrOn":<0/1>,
				"isDipSwitchEnabled":<0/1>,
				"fwVer":"<value>",
				"uartBaudRate":"<value>",
				"irMode":"<emitter/sensor>",
				"rs232FeedbackIP":"<value>",
				"irFeedbackIP":"<value>",
				"isRs232FeedbackOn":<0/1>,
				"isRs232IpHeader":<0/1>,
				"compressionRate":"<value>",
				"isAutoCompressionOn":<0/1>,
				"is60fps":<0/1>,
				"isDisplayConnected":<0/1>,
				"isScreenImageOn":<0/1>,
				"isScreenTextOn":<0/1>,
				"connected Mac":"<value>",
				"isAutoResolutionOn":<0/1>
			}
		]
		*/

		let added = false;

		for (let i = 0; i < result.p_data.length; i++) {
			let mac = result.p_data[i].mac;
			
			let found = false;

			for (let j = 0; j < self.devices.length; j++) {
				if (self.devices[j].mac === mac) {
					self.devices[j] = result.p_data[i];
					found = true;
					break;
				}
			}

			if (!found) {
				self.devices.push(result.p_data[i]);
			}
		}

		self.rebuildDeviceList();
	}).catch(function(message) {
		clearInterval(self.polling);
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.rebuildDeviceList = function () {
	//rebuilds the array of devices used in the actions list
	let self = this;

	self.devices_list = [];

	for (let i = 0; i < self.devices.length; i++) {
		let deviceObj = {};
		deviceObj.id = self.devices[i].mac;
		deviceObj.label = self.devices[i].customName + ' ' + self.devices[i].mac;
		self.devices_list.push(deviceObj);
	}

	self.actions(); //rebuild the actions
};

/**
 * Return config fields for web config.
 */
instance.prototype.config_fields = function() {
	var self = this;

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module will control a Muxlab KVM.'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'IP Address',
			width: 4,
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'username',
			label: 'Username',
			width: 4,
			default: 'admin'
		},
		{
			type: 'textinput',
			id: 'password',
			label: 'Password',
			width: 4,
			default: 'admin'
		},
		{
			type: 'textinput',
			id: 'systemid',
			label: 'System ID',
			width: 4,
			default: '0'
		},
		{
			type: 'checkbox',
			id: 'polling',
			label: 'Auto-polling (every 5s)',
			width: 4,
			default: true
		},

	];

};


/**
 * Cleanup when the module gets deleted.
 */
instance.prototype.destroy = function() {
	var self = this;
	clearInterval(self.polling)
	self.debug("destroy");
};


/**
 * Populates the supported actions.
 */
instance.prototype.actions = function(system) {
	var self = this;

	self.setActions({
		'connect': {
			label: 'Connect a Device',
			options: [
				{
					type: 'dropdown',
					label: 'Transmitter',
					id: 'device_tx',
					choices: self.devices_list
				},
				{
					type: 'dropdown',
					label: 'Receiver',
					id: 'device_rx',
					choices: self.devices_list
				}
			]
		},
		'connect_manual': {
			label: 'Connect a Device (Manual)',
			options: [
				{
					type: 'textinput',
					label: 'Transmitter (MAC Address)',
					id: 'device_tx',
					width: 4
				},
				{
					type: 'textinput',
					label: 'Receiver (MAC Address)',
					id: 'device_rx',
					width: 4
				}
			]
		},
		'disconnect': {
			label: 'Disconnect a Device',
			options: [
				{
					type: 'dropdown',
					label: 'Receiver',
					id: 'device_rx',
					choices: self.devices_list
				}
			]
		},
		'disconnect_manual': {
			label: 'Disconnect a Device (Manual)',
			options: [
				{
					type: 'textinput',
					label: 'Receiver (MAC Address)',
					id: 'device_rx',
					width: 4
				}
			]
		},
		'reboot': {
			label: 'Reboot a Device',
			options: [
				{
					type: 'dropdown',
					label: 'Device',
					id: 'device',
					choices: self.devices_list
				}
			]
		},
		'reboot_manual': {
			label: 'Reboot a Device (Manual)',
			options: [
				{
					type: 'textinput',
					label: 'Device (MAC Address)',
					id: 'device',
					width: 4
				}
			]
		},
		'preset_apply': {
			label: 'Apply a Preset',
			options: [
				{
					type: 'textinput',
					label: 'Preset Number',
					id: 'preset',
					width: 4
				}
			]
		},
		'preset_save': {
			label: 'Save to Existing Preset',
			options: [
				{
					type: 'textinput',
					label: 'Preset Number',
					id: 'preset',
					width: 4
				}
			]
		},
		'preset_new': {
			label: 'Save to New Preset',
			options: [
				{
					type: 'textinput',
					label: 'Preset Name',
					id: 'preset_name',
					width: 4
				}
			]
		},
		'device_customname': {
			label: 'Set Device Custom Name',
			options: [
				{
					type: 'dropdown',
					label: 'Device',
					id: 'device',
					choices: self.devices_list
				},
				{
					type: 'textinput',
					label: 'Custom Name',
					id: 'custom_name',
					width: 4
				}
			]
		},
		'device_autocompression': {
			label: 'Set Device Auto Compression On/Off',
			options: [
				{
					type: 'dropdown',
					label: 'Device',
					id: 'device',
					choices: self.devices_list
				},
				{
					type: 'dropdown',
					label: 'On/Off',
					id: 'onoff',
					choices: [ { id: '0', label: 'Off' }, { id: '1', label: 'On' } ]
				}
			]
		},
		'device_60fps': {
			label: 'Set Device 60fps On/Off',
			options: [
				{
					type: 'dropdown',
					label: 'Device',
					id: 'device',
					choices: self.devices_list
				},
				{
					type: 'dropdown',
					label: 'On/Off',
					id: 'onoff',
					choices: [ { id: '0', label: 'Off' }, { id: '1', label: 'On' } ]
				}
			]
		}
	});
};

/**
 * Requests/Retrieves information via POST and returns a Promise.
 *
 * @param cmd           The command to execute
 * @param body          The body of the POST; an object.
 * @return              A Promise that's resolved after the POST.
 */
instance.prototype.postRest = function(body) {
	var self = this;
	return self.doRest('POST', body);
};

/**
 * Performs the REST command, either GET or POST.
 *
 * @param method        Either GET or POST
 * @param cmd           The command to execute
 * @param body          If POST, an object containing the POST's body
 */
instance.prototype.doRest = function(method, body) {
	var self = this;
	var url  = self.makeUrl();

	return new Promise(function(resolve, reject) {

		function handleResponse(err, result) {
			if (err === null && typeof result === 'object' && result.response.statusCode === 200) {
				// A successful response
				resolve(result);
			} else {
				// Failure. Reject the promise.
				var message = 'Unknown error';

				if (result !== undefined) {
					if (result.response !== undefined) {
						message = result.response.statusCode + ': ' + result.response.statusMessage;
					} else if (result.error !== undefined) {
						// Get the error message from the object if present.
						message = result.error.code +': ' + result.error.message;
					}
				}

				reject(message);
			}
		}

		let headers = {};

		let extra_args = {};

		switch(method) {
			case 'POST':
				self.system.emit('rest', url, body, function(err, result) {
						handleResponse(err, result);
					}, headers, extra_args
				);
				break;

			default:
				throw new Error('Invalid method');

		}

	});

};


/**
 * Runs the specified action.
 *
 * @param action
 */
instance.prototype.action = function(action) {
	var self = this;
	var opt = action.options;

	try {
		switch (action.action) {
			case 'connect':
			case 'connect_manual':
				self.connect(opt.device_tx, opt.device_rx);
				break;
			case 'disconnect':
			case 'disconnect_manual':
				self.disconnect(opt.device_rx);
				break;
			case 'reboot':
			case 'reboot_manual':
				self.reboot(opt.device);
				break;
			case 'preset_apply':
				self.presetApply(opt.preset);
				break;
			case 'preset_save':
				self.presetSave(opt.preset);
				break;
			case 'preset_new':
				self.presetNew(opt.preset_name);
				break;
			case 'device_customname':
				self.device_setAttribute(opt.device, 'customName', opt.custom_name);
				break;
			case 'device_autocompression':
				self.device_setAttribute(opt.device, 'isAutoCompressionOn', parseInt(opt.onoff));
				break;
			case 'device_60fps':
				self.device_setAttribute(opt.device, 'is60fps', parseInt(opt.onoff));
				break;
		}

	} catch (err) {
		self.log('error', err.message);
	}
};

instance.prototype.connect = function (tx, rx) {
	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_userName': self.config.username,
		'p_password': self.config.password,
		'p_cmd': 'connection',
		'p_data': [
			{
				'macRx': rx,
				'macTx': tx
			}
		]
	};

	self.postRest(cmd, jsonBody).then(function(result) {
		//process results
		/*
		"p_targetId":<systemID>,
		"p_cmd":"connection",
		"p_rspStatus":"SUCCESS",
		"p_msg":"<a message>",
		"p_data":[
			{"macRx":"<Rx device mac address>",
			"macTx":"<Tx device mac address>",
			"p_rspStatus":"SUCCESS or FAILED",
			"msg":""
		]
		*/
		if (result.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Connection successful: ${tx}:${rx}`);
		}
		else if (result.p_rspStatus === 'FAILED') {
			throw `Connection failed: ${tx}:${rx}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.disconnect = function (rx) {
	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_userName': self.config.username,
		'p_password': self.config.password,
		'p_cmd': 'connection',
		'p_data': [
			{
				'macRx': rx,
				'macTx': '00-00-00-00-00-00'
			}
		]
	};

	self.postRest(cmd, jsonBody).then(function(result) {
		//process results
		/*
		"p_targetId":<systemID>,
		"p_cmd":"connection",
		"p_rspStatus":"SUCCESS",
		"p_msg":"<a message>",
		"p_data":[
			{"macRx":"<Rx device mac address>",
			"macTx":"<Tx device mac address>",
			"p_rspStatus":"SUCCESS or FAILED",
			"msg":""
		]
		*/
		if (result.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Disconnection successful: ${rx}`);
		}
		else if (result.p_rspStatus === 'FAILED') {
			throw `Disconnection failed: ${rx}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.reboot = function (device) {
	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_userName': self.config.username,
		'p_password': self.config.password,
		'p_cmd': 'reboot_devices',
		'p_data': [
			{
				'mac': device
			}
		]
	};

	self.postRest(cmd, jsonBody).then(function(result) {
		//process results
		/*
		"p_targetId":<systemID>,
		"p_cmd":"update_devices",
		"p_rspStatus":"SUCCESS",
		"p_msg":"<a message>",
		"p_data":[
			{"mac":"<device mac address>",
			”p_rspStatus”:"SUCCESS or FAILED","msg":""}
		]
		*/
		if (result.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Reboot successful: ${device}`);
		}
		else if (result.p_rspStatus === 'FAILED') {
			throw `Reboot failed: ${device}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.presetApply = function (preset) {
	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_userName': self.config.username,
		'p_password': self.config.password,
		'p_cmd': 'select_preset',
		'p_data': [
			{
				'presetId': preset
			}
		]
	};

	self.postRest(cmd, jsonBody).then(function(result) {
		//process results
		if (result.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Preset Apply successful: ${preset}`);
		}
		else if (result.p_rspStatus === 'FAILED') {
			throw `Preset Apply failed: ${preset}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.presetSave = function (preset) {
	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_userName': self.config.username,
		'p_password': self.config.password,
		'p_cmd': 'save_preset',
		'p_data': [
			{
				'presetId': preset
			}
		]
	};

	self.postRest(cmd, jsonBody).then(function(result) {
		//process results
		if (result.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Preset Save successful: ${preset}`);
		}
		else if (result.p_rspStatus === 'FAILED') {
			throw `Preset Save failed: ${preset}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.presetNew = function (preset_name) {
	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_userName': self.config.username,
		'p_password': self.config.password,
		'p_cmd': 'create_preset',
		'p_data': [
			{
				'presetName': preset_name
			}
		]
	};

	self.postRest(cmd, jsonBody).then(function(result) {
		//process results
		if (result.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Preset Save New successful: ${preset_name}`);
		}
		else if (result.p_rspStatus === 'FAILED') {
			throw `Preset Save New failed: ${preset_name}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.device_setAttribute = function (device, attributeName, attributeValue) {
	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_userName': self.config.username,
		'p_password': self.config.password,
		'p_cmd': 'update_devices',
		'p_data': [
			{
				'mac': device,
				[attributeName]: attributeValue
			}
		]
	};

	self.postRest(cmd, jsonBody).then(function(result) {
		//process results
		if (result.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Device Attribute ${attributeName} set successful: ${device}`);
		}
		else if (result.p_rspStatus === 'FAILED') {
			throw `Device Attribute ${attributeName} set failed: ${device}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

/**
 * Makes the complete URL.
 *
 * @param cmd           Must start with a /
 */
instance.prototype.makeUrl = function() {
	var self = this;

	if (cmd[0] !== '/') {
		throw new Error('cmd must start with a /');
	}

	return 'http://' + self.config.host + apiUrl;
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;