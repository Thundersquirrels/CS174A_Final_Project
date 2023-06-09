import { defs, tiny } from './examples/common.js';
import { Body } from './examples/collisions-demo.js';

const {
	Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

export class Simulation extends Scene {
	// **Simulation** manages the stepping of simulation time.  Subclass it when making
	// a Scene that is a physics demo.  This technique is careful to totally decouple
	// the simulation from the frame rate (see below).
	constructor() {
		super();
		Object.assign(this, { time_accumulator: 0, time_scale: 1, t: 0, dt: 1 / 20, bodies: [], steps_taken: 0 });
		this.raining = true;
	}

	simulate(frame_time) {
		// simulate(): Carefully advance time according to Glenn Fiedler's
		// "Fix Your Timestep" blog post.
		// This line gives ourselves a way to trick the simulator into thinking
		// that the display framerate is running fast or slow:
		frame_time = this.time_scale * frame_time;

		// Avoid the spiral of death; limit the amount of time we will spend
		// computing during this timestep if display lags:
		this.time_accumulator += Math.min(frame_time, 0.1);
		// Repeatedly step the simulation until we're caught up with this frame:
		while (Math.abs(this.time_accumulator) >= this.dt) {
			// Single step of the simulation for all bodies:
			this.update_state(this.dt);
			for (let b of this.bodies)
				b.advance(this.dt);
			// Following the advice of the article, de-couple
			// our simulation time from our frame rate:
			this.t += Math.sign(frame_time) * this.dt;
			this.time_accumulator -= Math.sign(frame_time) * this.dt;
			this.steps_taken++;
		}
		// Store an interpolation factor for how close our frame fell in between
		// the two latest simulation time steps, so we can correctly blend the
		// two latest states and display the result.
		let alpha = this.time_accumulator / this.dt;
		for (let b of this.bodies) b.blend_state(alpha);
	}

	display(context, program_state) {
		// display(): advance the time and state of our whole simulation.
		if (program_state.animate)
			this.simulate(program_state.animation_delta_time);
		// Draw each shape at its current location:
		if (this.raining) {
			for (let b of this.bodies)
				b.shape.draw(context, program_state, b.drawn_location.times(Mat4.rotation(Math.PI / 2, 1, 1, 1)), b.material);
		}
	}

	update_state(dt)      // update_state(): Your subclass of Simulation has to override this abstract function.
	{
		throw "Override this"
	}
}

export class TotoroScene extends Simulation {
	// ** Inertia_Demo** demonstration: This scene lets random initial momentums
	// carry several bodies until they fall due to gravity and bounce.
	constructor() {
		super();
		this.angle = 0.1;		// purple umbrella angle
		this.angleSatsuki = 1.1;	// pink umbrella angle

		this.shapes = {
			cylinder: new defs.Capped_Cylinder(12, 12, [[0, 5], [0, 1]]),
			square: new defs.Square(),
			satsukiUmbrella: new Umbrella_Shape(8, this.angleSatsuki),  // Custom shape for umbrella
			totoroUmbrella: new Umbrella_Shape(8, this.angle),  // Custom shape for umbrella
			streetlamp: new Streetlamp(),
			lightbulb: new defs.Subdivision_Sphere(4),
			trees: [new Tree(), new Tree(), new Tree(), new Tree(), new Tree(), new Tree(), new Tree(), new Tree(), new Tree(), new Tree()],
			arrows: new defs.Axis_Arrows()
		}
		this.totoro = {
			leg_angle:0,
			main: new Totoro_Main(0),
			belly: new Totoro_Belly(),
			whisker: new Totoro_Whisker(),
			facing: Mat4.rotation(0,0,0,1),
			facing_angle:0
		}
		const shader = new defs.Fake_Bump_Map(1);
		this.materials = {
			test: new Material(shader, { color: color(.1, .9, .9, 1), ambient: .08, specularity: .3, diffusivity: 1, smoothness: 0.5 }),
			satsukiUmbrella: new Material(new defs.Phong_Shader(), { color: hex_color("#ff3080"), ambient: 0.05, specularity: 0.3, diffusivity: 0.7, smoothness: 0.8 }),
			totoroUmbrella: new Material(new defs.Phong_Shader(), { color: hex_color("#8020f0"), ambient: 0.05, specularity: 0.3, diffusivity: 0.7, smoothness: 0.8 }),
			totoro: new Material(new defs.Phong_Shader(), { color: hex_color("#363636"), ambient: 0.05, specularity: 0.3, diffusivity: 0.7, smoothness: 0.6 }),
			streetlamp: new Material(new defs.Phong_Shader(), { color: hex_color("#404040"), ambient: 0.08, specularity: 0.7, diffusivity: 1, smoothness: 0.4 }),
			lightbulb: new Material(new defs.Phong_Shader(), { color: color(1, 0, 0, .7), ambient: 0.08, specularity: 1, diffusivity: 1, smoothness: 1 }),
			tree: new Material(new defs.Phong_Shader(), { color: hex_color("#964b00"), ambient: 0.08, specularity: 0.3, diffusivity: 0.8, smoothness: 0.4 }),
			rain: new Material(new defs.Phong_Shader(), { color: color(0, 0, 1, 0.2), ambient: 0.08, specularity: 0.3, diffusivity: 0.8, smoothness: 0.4 }),
		}

		this.camera_transform = Mat4.translation(0, -2, -10).times(Mat4.rotation(0, 0, 1, 0));

		// SCENE AND TIMING VARIABLES
		this.scene = 1;			// scene number
		this.time = 0;			// elapsed time
		this.time_diff = 0;		// elapsed time during pause
		this.paused = false;	// are we in the paused scene

		// TOTORO & UMBRELLA VARIABLES
		this.totoroPos = 20;	// Totoro X position
		this.totoroPosY = 1.1;	// Totoro Y position
		this.totoroUmbrellaPos = -4;	// Totoro's umbrella position

		//// INTERACTIVITY STUFF: (only relevant during paused scene)
		// PINK UMBRELLA
		this.umbrellaState = true;	// pink umbrella opened/closed

		// OTHER TOGGLES
		this.lightOn = false;	// light on/off
		this.raining = true;	// rain on/off

		// JUMPING
		this.totoroJump = false;	// did we press jump
		this.totoroIsJumping = false;	// is he currently jumping
		this.totoroJump_start = 0;	// time when he started jumping
		this.normal_rain_count = 500;	// # of raindrops when not jumping
		this.jump_rain_count = 1000;	// # of raindrops post-jump
		this.rain_count = this.normal_rain_count;
	}
	totoro_walk(dPos) {
		this.totoroPos += dPos;
		this.totoro.leg_angle+=1;
		if(this.totoro.leg_angle%30==0)
			this.totoro.main = new Totoro_Main(0.1*Math.sin(this.totoro.leg_angle))
	}
	totoro_jump(time) {
		console.log(time - this.totoroJump_start);
		this.totoroPosY = 2.5 * (time - this.totoroJump_start) - 1 * (time - this.totoroJump_start) * (time - this.totoroJump_start) + 1.1;
		if (this.totoroPosY < 1.1) {
			this.totoroPosY = 1.1
			this.totoroJump = false;
			this.totoroJump_start = 0;
			this.totoroIsJumping = false;

			// make more rain fall
			this.rain_count = this.jump_rain_count;
			this.materials.rain = new Material(new defs.Phong_Shader(), { color: color(1, 1, 1, 0.8), ambient: 0.08, specularity: 0.3, diffusivity: 0.8, smoothness: 0.4 });
		}
	}
	make_control_panel() {
		// make_control_panel(): Create the buttons for interacting with simulation time.
		this.key_triggered_button("Speed up time", ["Shift", "T"], () => this.time_scale *= 5);
		this.key_triggered_button("Slow down time", ["t"], () => this.time_scale /= 5);
		this.new_line();
		this.live_string(box => {
			box.textContent = "Time scale: " + this.time_scale
		});
		this.new_line();
		this.key_triggered_button("Toggle Light", ["l"], () => this.lightOn = this.paused ? !this.lightOn : this.lightOn);
		this.new_line();
		this.live_string(box => {
			box.textContent = "Light state: " + (this.lightOn ? "On" : "Off")
		});
		this.new_line();
		this.key_triggered_button("Toggle Rain", ["r"], () => this.raining = this.paused ? !this.raining : this.raining);
		this.new_line();
		this.live_string(box => {
			box.textContent = "Rain state: " + (this.raining ? "On" : "Off")
		});
		this.new_line();
		this.key_triggered_button("Open/Close Umbrella", ["u"], () => this.umbrellaState = this.paused ? !this.umbrellaState : this.umbrellaState);
		this.new_line();
		this.live_string(box => {
			box.textContent = "Umbrella state: " + (this.umbrellaState ? "Open" : "Closed")
		});
		this.new_line();
		this.key_triggered_button("Make Totoro jump", ["j"], () => this.totoroJump = this.totoroIsJumping ? this.totoroJump : (this.paused && !this.totoroJump));
		this.new_line();
		this.key_triggered_button("Continue scene", ["c"], () => this.paused = false);
		this.new_line();
		this.live_string(box => {
			box.textContent = "Scene paused?: " + (this.paused ? "Yes" : "No")
		});
		// this.key_triggered_button("Walk", ["q"], () => this.totoro_walk(0.05))
	}

	update_state(dt) {
		this.time += dt;
		if (this.paused) {
			this.time_diff += dt;
		}
		// update_state():  Override the base time-stepping code to say what this particular
		// scene should do to its bodies every frame -- including applying forces.
		// Generate additional moving bodies if there ever aren't enough:
		while (this.bodies.length < this.rain_count) {
			this.bodies.push(new Body(this.shapes.cylinder, this.materials.rain, vec3(0.05, 0.05, 0.05))
				.emplace(Mat4.translation(...vec3(0, 10, 0).randomized(40)),
					vec3(0, -1, 0).normalized().times(3), Math.random()));
		}
		if (this.rain_count > this.normal_rain_count) {
			this.rain_count = this.normal_rain_count;
			this.materials.rain = new Material(new defs.Phong_Shader(), { color: color(0, 0, 1, 0.2), ambient: 0.08, specularity: 0.3, diffusivity: 0.8, smoothness: 0.4 });
		}

		for (let b of this.bodies) {
			// Gravity on Earth, where 1 unit in world space = 1 meter:
			b.linear_velocity[1] += dt * -1;
			// If about to fall through floor, reverse y velocity:
			if (b.center[1] < 0 && b.linear_velocity[1] < 0)
				b.linear_velocity[1] *= -.2;
		}
		// Delete bodies that stop or stray too far away:
		this.bodies = this.bodies.filter(b => b.center.norm() < 50 && b.linear_velocity.norm() > 3);

		if (this.time > 0 && this.time < 10) {
			this.scene = 1;
			this.camera_transform = Mat4.rotation(-1, 0, 1, 0).times(Mat4.translation(-5, -5, -5));
		}
		if (this.time > 10 && this.time < 10.1) {
			this.lightOn = true;
		}
		if (this.time > 20 && this.time < 40) {
			this.scene = 2;
			this.camera_transform = Mat4.rotation(-1.6, 0, 1, 0).times(Mat4.translation(-15, -3, -2));
		}
		if (this.time > 40 && this.time < 80 && this.totoroPos > 0) {
			this.totoro.facing_angle=-Math.PI/2
			this.totoro.facing = Mat4.rotation(this.totoro.facing_angle,0,1,0)
			this.totoro_walk(-0.03);
			this.camera_transform = Mat4.translation(0, -2, -10).times(Mat4.rotation(0, 0, 1, 0));
		}
		if(this.totoroPos<=0 &&this.totoro.facing_angle<0) {
			this.totoro.facing_angle += 0.006
			this.totoro.facing = this.totoro.facing.times(Mat4.rotation(0.006, 0, 1, 0))
			this.paused = true;
		}

		// Interactivity
		if (this.paused) {
			// umbrella stuff: satsuki's umbrella opens faster bc at the slower speed, if you open/closed too many
			// times, too many umbrella objects would get created & everything would crash :(
			if (this.umbrellaState && this.angleSatsuki < 1.1) { //open satsuki's umbrella
				this.angleSatsuki += 0.1;
				this.shapes.satsukiUmbrella = new Umbrella_Shape(8, this.angleSatsuki);
			} else if (!this.umbrellaState && this.angleSatsuki > 0.2) {
				this.angleSatsuki -= 0.1;
				this.shapes.satsukiUmbrella = new Umbrella_Shape(8, this.angleSatsuki);
			}

			// totoro jumps
			if (this.totoroJump) {
				this.totoroIsJumping = true;
				if (this.totoroJump_start === 0) {
					this.totoroJump_start = this.time;
				}
				this.totoro_jump(this.time);
			}
		}

		// Rest of the scene after continuing
		if (!this.paused) {
			if ((this.time - this.time_diff) > 80 && this.angle < 1.1) {
				this.angle += 0.01;
				this.shapes.totoroUmbrella = new Umbrella_Shape(8, this.angle);
			}
			if(100< (this.time - this.time_diff) && (this.time - this.time_diff) <=103){
				this.totoroUmbrellaPos += 0.03;
			}
			if((this.time - this.time_diff) >100 &&this.totoro.facing_angle<Math.PI/2){
				this.totoro.facing_angle+=0.005
				this.totoro.facing = this.totoro.facing.times(Mat4.rotation(0.005,0,1,0))
			}
			if ((this.time - this.time_diff) > 110 && (this.time - this.time_diff) <200) {
				this.totoroUmbrellaPos += 0.03;
			}
			if ((this.time - this.time_diff) > 113 && (this.time - this.time_diff) <200) {
				this.totoro.facing = Mat4.rotation(+Math.PI/2,0,1,0)
				this.totoro_walk(0.03);
				this.camera_transform = Mat4.rotation(1.6, 0, 1, 0).times(Mat4.translation(15, -3, -5));
			}
		}
	}

	display(context, program_state) {
		// display(): Draw everything else in the scene besides the moving bodies.
		super.display(context, program_state);
		const t = program_state.animation_time / 1000;

		// if (!context.scratchpad.controls) {
		// 	this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
		// 	this.children.push(new defs.Program_State_Viewer());
		// }
		program_state.set_camera(this.camera_transform);

		program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
		if (this.lightOn) {
			program_state.lights = [new Light(vec4(100, 5, 5, 1), color(1, 0.7, 0.5, 1), 5000), new Light(vec4(-5, 7, 0.9, 1), color(1, 0.7, 0.5, 1), 1000)];
		} else if (!this.paused && !this.lightOn) {
			program_state.lights = [new Light(vec4(100, 5, 0, 1), color(1, 0.7, 0.5, 1), 5000)];
		} else if (this.paused && !this.lightOn) {
			program_state.lights = [new Light(vec4(100, 5, 0, 1), color(0, 0, 0, 1), 5000)]; // black light lmfao
		}
		// Draw the ground:
		this.shapes.square.draw(context, program_state, Mat4.translation(0, 0, 0)
			.times(Mat4.rotation(Math.PI / 2, 1, 0, 0)).times(Mat4.scale(50, 50, 1)),
			this.materials.test.override(color(.1, .8, .6, 1)));

		// Draw satsuki's umbrella
		const satsuki_umbrella_transform = Mat4.translation(-2.5, 2, 0).times(Mat4.scale(1.4, 1.4, 1.4).times(Mat4.rotation(Math.PI / 2, 1, 0, 0)));
		this.shapes.satsukiUmbrella.draw(context, program_state, satsuki_umbrella_transform, this.materials.satsukiUmbrella);
		// Draw totoro's umbrella
		const totoro_umbrella_transform = Mat4.translation(this.totoroUmbrellaPos, 2, 0).times(Mat4.scale(1.5, 1.5, 1.5).times(Mat4.rotation(Math.PI / 2, 1, 0, 0)));
		this.shapes.totoroUmbrella.draw(context, program_state, totoro_umbrella_transform, this.materials.totoroUmbrella);
		// Draw totoro
		const totoro_transform = Mat4.translation(this.totoroPos, this.totoroPosY, 0).times(Mat4.scale(0.3, 0.3, 0.3).times(this.totoro.facing));
		this.totoro.main.draw(context, program_state, totoro_transform, this.materials.totoro);
		this.totoro.belly.draw(context, program_state, totoro_transform, this.materials.totoro.override({ color: hex_color("#ffeed0") }));
		this.totoro.whisker.draw(context, program_state, totoro_transform, this.materials.totoro.override({ color: hex_color("#000000") }));

		// Draw street lamp and its lightbulb
		const streetlamp_transform = Mat4.translation(-5, 8, -2);
		const lightbulb_transform = Mat4.translation(-5, 7, -0.9).times(Mat4.scale(0.3, 0.3, 0.3));
		this.shapes.streetlamp.draw(context, program_state, streetlamp_transform, this.materials.streetlamp);
		this.shapes.lightbulb.draw(context, program_state, lightbulb_transform, this.materials.lightbulb);
		// Draw forest of trees
		this.shapes.trees[0].draw(context, program_state, Mat4.translation(5, 0, -5).times(Mat4.scale(0.6, 0.6, 0.6)), this.materials.tree);
		this.shapes.trees[1].draw(context, program_state, Mat4.translation(-4, 0, -16).times(Mat4.scale(0.6, 0.6, 0.6)), this.materials.tree);
		this.shapes.trees[2].draw(context, program_state, Mat4.translation(-10, 0, -10).times(Mat4.scale(1, 1, 1)), this.materials.tree);
		this.shapes.trees[3].draw(context, program_state, Mat4.translation(-15, 0, -8).times(Mat4.scale(0.8, 0.8, 0.8)), this.materials.tree);
		this.shapes.trees[4].draw(context, program_state, Mat4.translation(5, 0, 14).times(Mat4.scale(0.6, 0.6, 0.6)), this.materials.tree);
		this.shapes.trees[5].draw(context, program_state, Mat4.translation(-2, 0, 13).times(Mat4.scale(0.6, 0.6, 0.6)), this.materials.tree);
		this.shapes.trees[6].draw(context, program_state, Mat4.translation(-10, 0, 17).times(Mat4.scale(1, 1, 1)), this.materials.tree);
		this.shapes.trees[7].draw(context, program_state, Mat4.translation(10, 0, 15).times(Mat4.scale(0.8, 0.8, 0.8)), this.materials.tree);
		this.shapes.trees[8].draw(context, program_state, Mat4.translation(20, 0, -4).times(Mat4.scale(1, 1, 1)), this.materials.tree);
		this.shapes.trees[9].draw(context, program_state, Mat4.translation(20, 0, 15).times(Mat4.scale(0.8, 0.8, 0.8)), this.materials.tree);
	}
}

class Umbrella_Shape extends Shape {
	// Build a donut shape.  An example of a surface of revolution.
	constructor(sections, angle, texture_range = [[0, 1], [0, 1]]) {
		super("position", "normal", "texture_coord");
		const x = Math.sin(angle);
		const y = Math.cos(angle);
		// Top cover of umbrella
		defs.Surface_Of_Revolution.insert_transformed_copy_into(this, [50, sections, [vec3(x, 0, y), vec3(x * 0.95, 0, y * 0.8), vec3(x * 0.8, 0, y * 0.5), vec3(x * 0.5, 0, y * 0.2), vec3(0, 0, 0)], texture_range]);
		// Middle stick of umbrella
		defs.Surface_Of_Revolution.insert_transformed_copy_into(this, [3, 10, [vec3(0, 0, 0), vec3(0.02, 0, 0), vec3(0.02, 0, 1.1), vec3(0, 0, 1.1)], texture_range]);
		// Bottom handle of umbrella
		defs.Surface_Of_Revolution.insert_transformed_copy_into(this, [10, 20, [vec3(0.2, 0, 0), vec3(0.165, 0, 0.015), vec3(0.15, 0, 0.05), vec3(0.165, 0, 0.085), vec3(0.2, 0, 0.1), vec3(0.235, 0, 0.085), vec3(0.25, 0, 0.05), vec3(0.235, 0, 0.015), vec3(0.2, 0, 0)], texture_range, Math.PI], Mat4.scale(0.6, 0.6, 0.75).times(Mat4.translation(0.2, 0.05, 1.43).times(Mat4.rotation(Math.PI / 2, 1, 0, 0))));
	}
}

class Streetlamp extends Shape {
	constructor() {
		super("position", "normal", "texture_coord");
		// Lamp post
		defs.Surface_Of_Revolution.insert_transformed_copy_into(this, [3, 10, [vec3(0, 0, 0), vec3(0.3, 0, 0), vec3(0.3, 0, 8), vec3(0, 0, 8)], [[0, 1], [0, 1]]], Mat4.translation(0, 0, 0).times(Mat4.rotation(Math.PI / 2, 1, 0, 0)));
		// Cone around lightbulb
		defs.Surface_Of_Revolution.insert_transformed_copy_into(this, [3, 10, [vec3(1, 0, 1), vec3(0.8, 0, 0.7), vec3(0.6, 0, 0.5), vec3(0.3, 0, 0.2), vec3(0, 0, 0)], [[0, 1], [0, 1]]], Mat4.translation(0, -0.4, 0.7).times(Mat4.rotation(1, 1, 0, 0)));
	}
}

class Tree extends Shape {
	constructor() {
		super("position", "normal", "texture_coord");
		// Tree trunk
		defs.Surface_Of_Revolution.insert_transformed_copy_into(this, [3, 10, [vec3(7, 0, 0), vec3(5, 0, 1.5), vec3(5, 0, 50), vec3(0, 0, 50)], [[0, 1], [0, 1]]], Mat4.translation(0, 0, 0).times(Mat4.rotation(-Math.PI / 2, 1, 0, 0)));
	}
}

class Totoro_Main extends Shape {
	constructor(leg_angle) {
		super("position", "normal", "texture_coord");
		//body
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.scale(3, 4, 3));
		//head
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.translation(0, 3, 0).times(Mat4.scale(2, 2, 2)));
		//ears
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.rotation(25, 0, 0, 1).times(Mat4.translation(0, 5, 0).times(Mat4.scale(0.35, 1.35, 0.35))));
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.rotation(-25, 0, 0, 1).times(Mat4.translation(0, 5, 0).times(Mat4.scale(0.35, 1.35, 0.35))));
		const arm_scale = Mat4.scale(0.4, 2.5, 2);
		//left arm
		const left_arm_transform = Mat4.rotation(Math.PI * (0.8), 0, 0, 1).times(Mat4.translation(3, 1, 0).times(arm_scale));
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], left_arm_transform);
		// right arm
		const right_arm_transform = Mat4.rotation(Math.PI * (-0.8), 0, 0, 1).times(Mat4.translation(-3, 1, 0).times(arm_scale));
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], right_arm_transform);
		//left leg
		const leg_scale = Mat4.scale(1, 2, 1);
		const left_leg_transform = Mat4.rotation(Math.PI * (-0.9), 0,leg_angle, 1).times(Mat4.translation(-1.3, 2.5, 0).times(leg_scale));
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], left_leg_transform);
		//right leg
		const right_left_transform = Mat4.rotation(Math.PI * (0.9), 0, -leg_angle, 1).times(Mat4.translation(1.3, 2.5, 0).times(leg_scale));
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], right_left_transform);

	}
}

class Totoro_Belly extends Shape {
	constructor() {
		super("position", "normal", "texture_coord");
		defs.Subdivision_Sphere.insert_transformed_copy_into(this, [4], Mat4.translation(0, -0.2, 0.7).times(Mat4.scale(2.65, 3.3, 2.65)));
	}
}

class Totoro_Whisker extends Shape {
	constructor() {
		super("position", "normal", "texture_coord");
		//right whiskers
		let whisker_transform = Mat4.rotation(Math.PI / 2, 0, 1, 0).times(Mat4.translation(-1.2, 3.5, -2).times(Mat4.scale(0.1, 0.1, 1.75))).times(Mat4.rotation(Math.PI / 2, 0, 1, 0))
		let whisker_transform1 = Mat4.rotation(-0.1, 0, 0, 1).times(whisker_transform)
		defs.Capped_Cylinder.insert_transformed_copy_into(this, [12, 12, [[0, 5], [0, 1]]], whisker_transform1);
		let whisker_transform2 = Mat4.translation(0, -0.1, 0).times(Mat4.rotation(0.1, 0, 0, 1).times(whisker_transform1))
		defs.Capped_Cylinder.insert_transformed_copy_into(this, [12, 12, [[0, 5], [0, 1]]], whisker_transform2);
		let whisker_transform3 = Mat4.translation(0.5, -0.1, 0).times(Mat4.rotation(0.1, 0, 0, 1)).times(whisker_transform2)
		defs.Capped_Cylinder.insert_transformed_copy_into(this, [12, 12, [[0, 5], [0, 1]]], whisker_transform3);

		//left whiskers
		defs.Capped_Cylinder.insert_transformed_copy_into(this, [12, 12, [[0, 5], [0, 1]]], Mat4.scale(-1, 1, 1).times(whisker_transform1));
		defs.Capped_Cylinder.insert_transformed_copy_into(this, [12, 12, [[0, 5], [0, 1]]], Mat4.scale(-1, 1, 1).times(whisker_transform2));
		defs.Capped_Cylinder.insert_transformed_copy_into(this, [12, 12, [[0, 5], [0, 1]]], Mat4.scale(-1, 1, 1).times(whisker_transform3));

	}
}

