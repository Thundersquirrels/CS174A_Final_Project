import {defs, tiny} from './examples/common.js';
import {Body, Simulation, Test_Data} from './examples/collisions-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

export class Assignment3 extends Simulation {
    // ** Inertia_Demo** demonstration: This scene lets random initial momentums
    // carry several bodies until they fall due to gravity and bounce.
    constructor() {
        super();
        this.shapes = {
            cylinder: new defs.Capped_Cylinder(12, 12, [[0, 5], [0, 1]]),
            square: new defs.Square(),
        }
        const shader = new defs.Fake_Bump_Map(1);
        this.material = new Material(shader, {color: color(.1, .9, .9, 1), ambient: .4})
    }

    update_state(dt) {
        // update_state():  Override the base time-stepping code to say what this particular
        // scene should do to its bodies every frame -- including applying forces.
        // Generate additional moving bodies if there ever aren't enough:
        while (this.bodies.length < 30)
            this.bodies.push(new Body(this.shapes.cylinder, this.material, vec3(0.2, 0.2, 0.2))
                .emplace(Mat4.translation(...vec3(0, 10, 0).randomized(40)),
                    vec3(0, -1, 0).randomized(2).normalized().times(3), Math.random()));

        for (let b of this.bodies) {
            // Gravity on Earth, where 1 unit in world space = 1 meter:
            b.linear_velocity[1] += dt * -9.8;
            // If about to fall through floor, reverse y velocity:
            if (b.center[1] < -8 && b.linear_velocity[1] < 0)
                b.linear_velocity[1] *= -.8;
        }
        // Delete bodies that stop or stray too far away:
        this.bodies = this.bodies.filter(b => b.center.norm() < 50 && b.linear_velocity.norm() > 3);
    }

    display(context, program_state) {
        // display(): Draw everything else in the scene besides the moving bodies.
        super.display(context, program_state);

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            this.children.push(new defs.Program_State_Viewer());
            program_state.set_camera(Mat4.translation(0, 0, -50));    // Locate the camera here (inverted matrix).
        }
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        program_state.lights = [new Light(vec4(0, -5, -10, 1), color(1, 1, 1, 1), 100000)];
        // Draw the ground:
        this.shapes.square.draw(context, program_state, Mat4.translation(0, -10, 0)
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0)).times(Mat4.scale(50, 50, 1)),
            this.material.override(color(.1, .8, .6, 1)));
    }
}
