import { Box3, type Group, type Object3DEventMap, type SkinnedMesh, Vector3 } from 'three'
import { Mesh2MotionEngine } from '../Mesh2MotionEngine.ts'
import { ModalDialog } from '../lib/ModalDialog.ts'
import { RetargetUtils } from './RetargetUtils.ts'

/**
 * Handles loading the target model (user-uploaded model) for retargeting
 */
export class StepLoadTargetModel extends EventTarget {
  private readonly mesh2motion_engine: Mesh2MotionEngine
  private file_input: HTMLInputElement | null = null
  private load_model_button: HTMLLabelElement | null = null

  constructor (mesh2motion_engine: Mesh2MotionEngine) {
    super()
    this.mesh2motion_engine = mesh2motion_engine
  }

  public begin (): void {
    this.add_event_listeners()
  }

  private add_event_listeners (): void {
    // Get DOM elements
    this.file_input = document.getElementById('upload-file') as HTMLInputElement
    this.load_model_button = document.getElementById('load-model-button') as HTMLLabelElement

    if (this.file_input === null) {
      console.error('Could not find file input element')
      return
    }

    // Add event listener for file selection
    this.file_input.addEventListener('change', (event) => {
      console.log('File input changed', event)
      this.handle_file_select(event)
    })
  }

  private handle_file_select (event: Event): void {
    const target = event.target as HTMLInputElement
    if (target.files !== null && target.files.length > 0) {
      const file = target.files[0]
      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type)

      // Get file extension
      const file_name = file.name.toLowerCase()
      let file_extension = ''
      if (file_name.endsWith('.glb')) {
        file_extension = 'glb'
      } else if (file_name.endsWith('.fbx')) {
        file_extension = 'fbx'
      } else if (file_name.endsWith('.zip')) {
        file_extension = 'zip'
      } else {
        new ModalDialog('Unsupported file type. Please select a GLB, FBX, or ZIP file.', 'Error').show()
        return
      }

      // Configure the model loader to preserve all objects (bones, etc.)
      this.mesh2motion_engine.load_model_step.set_preserve_skinned_mesh(true)

      // Create a URL for the file and load it
      const file_url = URL.createObjectURL(file)

      try {
        this.mesh2motion_engine.load_model_step.load_model_file(file_url, file_extension)

        this.mesh2motion_engine.load_model_step.addEventListener('modelLoadedForRetargeting', () => {
          console.log('Model loaded for retargeting successfully.')
          URL.revokeObjectURL(file_url) // Revoke the object URL after loading is complete

          // read in mesh2motion engine's retargetable model data (this is the target)
          const retargetable_meshes = this.mesh2motion_engine.load_model_step.get_final_retargetable_model_data()
          const is_valid_skinned_mesh = RetargetUtils.validate_skinned_mesh_has_bones(retargetable_meshes)
          if (is_valid_skinned_mesh) {
            console.log('adding retargetable meshes to scene for retargeting')
            RetargetUtils.reset_skinned_mesh_to_rest_pose(retargetable_meshes)
            this.mesh2motion_engine.get_scene().add(retargetable_meshes)

            // Adjust camera based on model size
            this.adjust_camera_for_model(retargetable_meshes)

            // Add skeleton helper
            this.add_skeleton_helper(retargetable_meshes)
            
            // Dispatch event with loaded model data
            this.dispatch_target_model_loaded(retargetable_meshes)
          }
        }, { once: true })
      } catch (error) {
        console.error('Error loading model:', error)
        new ModalDialog('Error loading model file.', 'Error').show()
        URL.revokeObjectURL(file_url) // Clean up the URL
      }
    }
  }

  private add_skeleton_helper (retargetable_meshes: Group<Object3DEventMap>): void {
    retargetable_meshes.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        const skinned_mesh = child as SkinnedMesh
        this.mesh2motion_engine.regenerate_skeleton_helper(skinned_mesh.skeleton, 'Retarget Skeleton Helper')
      }
    })
  }

  private adjust_camera_for_model (model_group: Group<Object3DEventMap>): void {
    // Calculate bounding box of the model
    const bounding_box = new Box3().setFromObject(model_group)
    
    // Calculate model dimensions
    const size = new Vector3()
    bounding_box.getSize(size)
    
    // Calculate center of the model
    const center = new Vector3()
    bounding_box.getCenter(center)
    
    // Get the maximum dimension (height, width, or depth)
    const max_dimension = Math.max(size.x, size.y, size.z)

    // Disable fog for retargeting to prevent models from appearing foggy when zoomed far out    
    if (max_dimension > 50) {
      console.log('Model is very large. Removing fog to increase visibility: ', max_dimension)
      this.mesh2motion_engine.set_fog_enabled(false)
    }
    
    // Calculate appropriate camera distance
    // Use a multiplier to ensure the entire model is visible
    // The 2.5 multiplier provides good framing with some padding
    const camera_distance = max_dimension * 2.5
    
    // Position camera to look at the center of the model
    // Keep camera slightly elevated (looking down at the model)
    const camera_position = new Vector3(
      center.x,
      center.y + max_dimension * 0.3, // Slight elevation based on model size
      center.z + camera_distance
    )
    
    this.mesh2motion_engine.set_camera_position(camera_position)
    
    console.log('Adjusted camera for model:', {
      bounding_box_size: size,
      center: center,
      max_dimension: max_dimension,
      camera_distance: camera_distance,
      camera_position: camera_position
    })
  }

  private dispatch_target_model_loaded (retargetable_meshes: Group<Object3DEventMap>): void {
    this.dispatchEvent(new CustomEvent('target-model-loaded', {
      detail: { retargetable_meshes }
    }))
  }
}
