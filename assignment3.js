import {defs, tiny} from './examples/common.js';
import {Body, Simulation, Test_Data} from './examples/collisions-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;


class Totoro extends Shape {
    // **Cube** A closed 3D shape, and the first example of a compound shape (a Shape constructed
    // out of other Shapes).  A cube inserts six Square strips into its own arrays, using six
    // different matrices as offsets for each square.
    constructor() {
        super("position", "normal", "texture_coord");
        // // Loop 3 times (for each axis), and inside loop twice (for opposing cube sides):
        // for (let i = 0; i < 2; i++)
        //     for (let j = 0; j < 2; j++) {
        //         const square_transform = Mat4.rotation(i == 0 ? Math.PI / 2 : 0, 1, 0, 0)
        //             .times(Mat4.rotation(Math.PI * j - (i == 1 ? Math.PI / 2 : 0), 0, 1, 0))
        //             .times(Mat4.translation(0, 0, 1));
        //         // Calling this function of a Square (or any Shape) copies it into the specified
        //         // Shape (this one) at the specified matrix offset (square_transform):
        //         defs.Square.insert_transformed_copy_into(this, [], square_transform);
        //     }
        
        //body
        defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.scale(3,4,3));
        //head
        defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.translation(0,3,0).times(Mat4.scale(2,2,2)));
        //ears
        defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.rotation(25,0,0,1).times(Mat4.translation(0,5,0).times(Mat4.scale(0.35,1.35,0.35))));
        defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.rotation(-25,0,0,1).times(Mat4.translation(0,5,0).times(Mat4.scale(0.35,1.35,0.35))));
        
        const arm_scale = Mat4.scale(0.6, 2.5, 2);
        //left arm
        const left_arm_transform = Mat4.rotation(10,0,0,1).times(Mat4.translation(-3, 2, 0).times(arm_scale));
        defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], left_arm_transform);
        // right arm
        const right_arm_transform = Mat4.rotation(-10,0,0,1).times(Mat4.translation(3, 2, 0).times(arm_scale));
        defs.Subdivision_Sphere.insert_transformed_copy_into(this, [3], right_arm_transform);
    }
}

export class Assignment3 extends Simulation {
    // ** Inertia_Demo** demonstration: This scene lets random initial momentums
    // carry several bodies until they fall due to gravity and bounce.
    constructor() {
        super();
        this.shapes = {
            cylinder: new defs.Capped_Cylinder(12, 12, [[0, 5], [0, 1]]),
            square: new defs.Square(),
            totoro: new Totoro() // Add the Totoro shape to the shapes object
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

        this.shapes.totoro.draw(context, program_state, Mat4.identity(), this.material);

    }
}

