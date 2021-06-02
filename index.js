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
instance.prototype.devices_list_tx = [ { id: '0', label: '(no transmitters found)'} ];
instance.prototype.devices_list_rx = [ { id: '0', label: '(no receivers found)'} ];
instance.prototype.devices_list_all = [ { id: '0', label: '(no devices found)'} ];

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
		self.config.systemid = parseInt(self.config.systemid);

		if (self.config.polling) {
			self.polling = setInterval(() => {
				self.get_devices();
			}, 300000); //5 minutes
		}
	}
};

instance.prototype.get_devices = function() {
	let self = this;

	let jsonBody = {
		'p_targetId': self.config.systemid,
		'p_cmd': 'get_devices',
		'p_userName': self.config.username,
		'p_password': self.config.password
	};

	self.postRest(jsonBody).then(function(result) {
		//process results
		let data = JSON.parse(result.data.toString());

		if (data.p_rspStatus === 'SUCCESS') {
			self.status(self.STATUS_OK);

			for (let i = 0; i < data.p_data.length; i++) {
				let mac = data.p_data[i].mac;
				
				let found = false;
	
				for (let j = 0; j < self.devices.length; j++) {
					if (self.devices[j].mac === mac) {
						self.devices[j] = data.p_data[i];
						found = true;
						break;
					}
				}
	
				if (!found) {
					self.devices.push(data.p_data[i]);
				}
			}
	
			self.rebuildDeviceList();
		}
		else if (data.p_rspStatus === 'FAILED') {
			self.log('error', 'Failed to get devices');
		}
	}).catch(function(message) {
		clearInterval(self.polling);
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.rebuildDeviceList = function () {
	//rebuilds the array of devices used in the actions list
	let self = this;

	self.devices_list_tx = [];
	self.devices_list_rx = [];
	self.devices_list_all = [];

	let defaultTXObj = {
		id: '0',
		label: '(choose a transmitter)'
	}
	self.devices_list_tx.push(defaultTXObj);

	let defaultRXObj = {
		id: '0',
		label: '(choose a receiver)'
	}
	self.devices_list_rx.push(defaultRXObj);

	let defaultObj = {
		id: '0',
		label: '(choose a device)'
	}
	self.devices_list_all.push(defaultObj);

	for (let i = 0; i < self.devices.length; i++) {
		let deviceObj = {};
		deviceObj.id = self.devices[i].mac;
		deviceObj.label = self.devices[i].customName + ' ' + self.devices[i].mac;
		if (self.devices[i].modelName.indexOf('-TX') > -1) {
			self.devices_list_tx.push(deviceObj);
		}
		else {
			self.devices_list_rx.push(deviceObj);
		}
		self.devices_list_all.push(deviceObj);
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
			default: '1'
		},
		{
			type: 'checkbox',
			id: 'polling',
			label: 'Auto-polling (every 5m)',
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
					choices: self.devices_list_tx
				},
				{
					type: 'dropdown',
					label: 'Receiver',
					id: 'device_rx',
					choices: self.devices_list_rx
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
					choices: self.devices_list_rx
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
					choices: self.devices_list_all
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
					choices: self.devices_list_all
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
					choices: self.devices_list_all
				},
				{
					type: 'dropdown',
					label: 'On/Off',
					id: 'onoff',
					choices: [ { id: '0', label: 'Off' }, { id: '1', label: 'On' } ],
					default: '0'
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
					choices: self.devices_list_all
				},
				{
					type: 'dropdown',
					label: 'On/Off',
					id: 'onoff',
					choices: [ { id: '0', label: 'Off' }, { id: '1', label: 'On' } ],
					default: '0'
				}
			]
		}
	});
};

/**
 * Requests/Retrieves information via POST and returns a Promise.
 *
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
	let self = this;

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

	self.postRest(jsonBody).then(function(result) {
		//process results

		let data = JSON.parse(result.data.toString());

		if (data.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Connection successful: ${tx}:${rx}`);
		}
		else if (data.p_rspStatus === 'FAILED') {
			throw `Connection failed: ${tx}:${rx}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.disconnect = function (rx) {
	let self = this;

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

	self.postRest(jsonBody).then(function(result) {
		//self.log('info', result);
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

		let data = JSON.parse(result.data.toString());

		if (data.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Disconnection successful: ${rx}`);
		}
		else if (data.p_rspStatus === 'FAILED') {
			throw `Disconnection failed: ${rx}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.reboot = function (device) {
	let self = this;

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

	self.postRest(jsonBody).then(function(result) {
		//self.log('info', result);
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

		let data = JSON.parse(result.data.toString());

		if (data.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Reboot successful: ${device}`);
		}
		else if (data.p_rspStatus === 'FAILED') {
			throw `Reboot failed: ${device}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.presetApply = function (preset) {
	let self = this;

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

	self.postRest(jsonBody).then(function(result) {
		//self.log('info', result);
		//process results

		let data = JSON.parse(result.data.toString());

		if (data.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Preset Apply successful: ${preset}`);
		}
		else if (data.p_rspStatus === 'FAILED') {
			throw `Preset Apply failed: ${preset}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.presetSave = function (preset) {
	let self = this;

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

	self.postRest(jsonBody).then(function(result) {
		//self.log('info', result);
		//process results

		let data = JSON.parse(result.data.toString());

		if (data.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Preset Save successful: ${preset}`);
		}
		else if (data.p_rspStatus === 'FAILED') {
			throw `Preset Save failed: ${preset}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.presetNew = function (preset_name) {
	let self = this;

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

	self.postRest(jsonBody).then(function(result) {
		//self.log('info', result);
		//process results

		let data = JSON.parse(result.data.toString());

		if (data.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Preset Save New successful: ${preset_name}`);
		}
		else if (data.p_rspStatus === 'FAILED') {
			throw `Preset Save New failed: ${preset_name}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

instance.prototype.device_setAttribute = function (device, attributeName, attributeValue) {
	let self = this;

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

	self.postRest(jsonBody).then(function(result) {
		//self.log('info', result);
		//process results

		let data = JSON.parse(result.data.toString());

		if (data.p_rspStatus === 'SUCCESS') {
			//succeeded
			self.status(self.STATUS_OK);
			self.log('info', `Device Attribute ${attributeName} set successful: ${device}`);
		}
		else if (data.p_rspStatus === 'FAILED') {
			throw `Device Attribute ${attributeName} set failed: ${device}`;
		}
	}).catch(function(message) {
		self.status(self.STATUS_ERROR);
		self.log('error', self.config.host + ' : ' + message);
	});
};

/**
 * Makes the complete URL.
 */
instance.prototype.makeUrl = function() {
	var self = this;

	return 'http://' + self.config.host + apiUrl;
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;