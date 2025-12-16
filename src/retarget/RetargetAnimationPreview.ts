import { AnimationClip, AnimationMixer, type Scene, type SkinnedMesh, VectorKeyframeTrack, QuaternionKeyframeTrack, type AnimationAction, Quaternion, Euler } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SkeletonType } from '../lib/enums/SkeletonType.ts'
import { AnimationUtility } from '../lib/processes/animations-listing/AnimationUtility.ts'
import type { StepBoneMapping } from './StepBoneMapping.ts'
import { TargetBoneMappingType } from './StepBoneMapping.ts'

/**
 * RetargetAnimationPreview - Provides live preview of bone retargeting by automatically
 * loading and playing animations while applying bone mappings in real-time
 */
export class RetargetAnimationPreview extends EventTarget {
  private readonly _main_scene: Scene
  private readonly step_bone_mapping: StepBoneMapping
  private readonly gltf_loader: GLTFLoader = new GLTFLoader()

  private animation_mixer: AnimationMixer | null = null
  private current_animation_clip: AnimationClip | null = null
  private retargeted_animation_clip: AnimationClip | null = null
  private target_skinned_meshes: SkinnedMesh[] = []

  private is_preview_active: boolean = false
  private _added_event_listeners: boolean = false

  constructor (main_scene: Scene, step_bone_mapping: StepBoneMapping) {
    super()
    this._main_scene = main_scene
    this.step_bone_mapping = step_bone_mapping
  }

  public begin (): void {
    if (!this._added_event_listeners) {
      this.add_event_listeners()
      this._added_event_listeners = true
    }
  }

  private add_event_listeners (): void {
    // Listen for bone mapping changes
    this.step_bone_mapping.addEventListener('bone-mappings-changed', () => {
      console.log('Bone mappings changed, updating preview animation...')
      this.update_preview_animation()
    })
  }

  /**
   * Start the preview system by loading the first available animation
   */
  public async start_preview (): Promise<void> {
    if (!this.step_bone_mapping.has_both_skeletons()) {
      console.log('Cannot start preview: both skeletons are required')
      return
    }

    const target_skeleton_data = this.step_bone_mapping.get_target_skeleton_data()
    if (target_skeleton_data === null) {
      console.log('Cannot start preview: target skeleton data is null')
      return
    }

    // Extract skinned meshes from target skeleton data
    this.target_skinned_meshes = []
    target_skeleton_data.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        this.target_skinned_meshes.push(child as SkinnedMesh)
      }
    })

    if (this.target_skinned_meshes.length === 0) {
      console.log('Cannot start preview: no skinned meshes found in target')
      return
    }

    // Create animation mixer for the target skeleton
    this.animation_mixer = new AnimationMixer(this.target_skinned_meshes[0])

    // Load the first animation based on skeleton type
    await this.load_first_animation()

    this.is_preview_active = true
    console.log('Preview started successfully')
  }

  /**
   * Stop the preview and clean up
   */
  public stop_preview (): void {
    if (this.animation_mixer !== null) {
      this.animation_mixer.stopAllAction()
      this.animation_mixer = null
    }

    this.current_animation_clip = null
    this.retargeted_animation_clip = null
    this.is_preview_active = false
    console.log('Preview stopped')
  }

  /**
   * Load the first animation from the appropriate animation file
   */
  private async load_first_animation (): Promise<void> {
    const source_skeleton_type = this.step_bone_mapping.get_source_skeleton_type()
    const animation_file_path = this.get_animation_file_path(source_skeleton_type)

    if (animation_file_path === null) {
      console.log('No animation file found for skeleton type:', source_skeleton_type)
      return
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.gltf_loader.load(
          animation_file_path,
          (gltf: any) => {
            if (gltf.animations !== null && gltf.animations !== undefined && gltf.animations.length > 0) {
              // find the "walk animation clip". every rig should have one of those.
              const walk_animation = gltf.animations.find((clip: AnimationClip) => clip.name.toLowerCase().includes('walk'))
              this.current_animation_clip = walk_animation ?? gltf.animations[0]

              if (this.current_animation_clip !== null) {
                console.log('Loaded animation:', this.current_animation_clip.name)

                // Clean up the animation track data before using it
                // This removes unnecessary position tracks and keeps only rotation data
                AnimationUtility.clean_track_data([this.current_animation_clip])
              }
              this.update_preview_animation()
              resolve()
            } else {
              reject(new Error('No animations found in file'))
            }
          },
          undefined,
          (error) => {
            reject(error)
          }
        )
      })
    } catch (error) {
      console.error('Error loading animation:', error)
    }
  }

  /**
   * Get the animation file path based on skeleton type
   */
  private get_animation_file_path (skeleton_type: SkeletonType): string | null {
    switch (skeleton_type) {
      case SkeletonType.Human:
        return '/animations/human-base-animations.glb'
      case SkeletonType.Quadraped:
        return '/animations/quad-creature-animations.glb'
      case SkeletonType.Bird:
        return '/animations/bird-animations.glb'
      case SkeletonType.Dragon:
        return '/animations/dragon-animations.glb'
      default:
        return null
    }
  }

  /**
   * Update the preview animation by applying current bone mappings
   */
  private update_preview_animation (): void {
    if (!this.is_preview_active || this.current_animation_clip === null || this.animation_mixer === null) {
      return
    }

    // Stop any currently playing animation
    this.animation_mixer.stopAllAction()

    // Get current bone mappings
    const bone_mappings = this.step_bone_mapping.get_bone_mapping()

    if (bone_mappings.size === 0) {
      console.log('No bone mappings yet, skipping animation retarget')
      return
    }

    // Create retargeted animation clip
    this.retargeted_animation_clip = this.retarget_animation_clip(
      this.current_animation_clip,
      bone_mappings
    )

    // Apply the retargeted animation to all target skinned meshes
    this.target_skinned_meshes.forEach((skinned_mesh) => {
      if (this.animation_mixer !== null && this.retargeted_animation_clip !== null) {
        const action: AnimationAction = this.animation_mixer.clipAction(this.retargeted_animation_clip, skinned_mesh)
        action.reset()
        action.play() // should loop automatically
      }
    })

    console.log('Preview animation updated and playing')
  }

  /**
   * Retarget an animation clip using bone mappings
   * @param source_clip - The original animation clip from the source skeleton
   * @param bone_mappings - Map of target bone name -> source bone name
   * @returns A new animation clip retargeted for the target skeleton
   */
  private retarget_animation_clip (source_clip: AnimationClip, bone_mappings: Map<string, string>): AnimationClip {
    const new_tracks: any[] = []

    // Create a reverse mapping for easier lookup: source bone name -> target bone names[]
    const reverse_mappings = new Map<string, string[]>()
    bone_mappings.forEach((source_bone_name, target_bone_name) => {
      if (!reverse_mappings.has(source_bone_name)) {
        reverse_mappings.set(source_bone_name, [])
      }
      const target_list = reverse_mappings.get(source_bone_name)
      if (target_list !== undefined) {
        target_list.push(target_bone_name)
      }
    })

    // Process each track in the source animation
    source_clip.tracks.forEach((track) => {
      // Parse the track name to get the bone name and property
      // Track names are typically in format: "boneName.property" or ".bones[boneName].property"
      const track_name_parts = this.parse_track_name(track.name)
      if (track_name_parts === null) {
        return
      }

      const { bone_name, property } = track_name_parts

      // Check if this bone is mapped to any target bones
      const target_bone_names = reverse_mappings.get(bone_name)
      if (target_bone_names === undefined || target_bone_names.length === 0) {
        return // Skip unmapped bones
      }

      // Create a track for each target bone this source bone maps to
      target_bone_names.forEach((target_bone_name) => {
        const new_track_name = this.create_track_name(target_bone_name, property)

        // Clone the track with the new name
        if (property === 'quaternion') {
          const new_track = new QuaternionKeyframeTrack(
            new_track_name,
            track.times.slice(),
            track.values.slice()
          )
          new_tracks.push(new_track)
        } else if (property === 'position' || property === 'scale') {
          const new_track = new VectorKeyframeTrack(
            new_track_name,
            track.times.slice(),
            track.values.slice()
          )
          new_tracks.push(new_track)
        }
      })
    })

    // Create the retargeted animation clip
    const retargeted_clip = new AnimationClip(
      `${source_clip.name}_retargeted`,
      source_clip.duration,
      new_tracks
    )

    // Apply Mixamo-specific corrections
    const target_mapping_type = this.step_bone_mapping.get_target_mapping_template()
    if (target_mapping_type === TargetBoneMappingType.Mixamo) {
      this.apply_mixamo_corrections(retargeted_clip)
    }

    console.log(`Retargeted animation: ${source_clip.name} (${new_tracks.length} tracks)`)
    return retargeted_clip
  }

  /**
   * Apply rotations to specific bones to correct them and normalize them for Mesh2Motion animations
   */
  private rotate_bone_for_retargeting (
    animation_clip: AnimationClip,
    bone_match_pattern: string[], rotate_obj: Euler,
    space: 'local' | 'world'): void {
    // Find all shoulder quaternion tracks (e.g., mixamorigLeftShoulder.quaternion)
    const tracks_to_change = animation_clip.tracks.filter(track =>
      bone_match_pattern.some(pattern => track.name.toLowerCase().includes(pattern.toLowerCase())) && track.name.includes('quaternion')
    ) as Array<{ name: string, times: Float32Array | number[], values: Float32Array | number[] }>

    if (tracks_to_change.length === 0) return

    // Object axis rotation amount. Final value is quaternion
    let rotation_amount: Quaternion = new Quaternion().setFromEuler(rotate_obj)

    for (const track of tracks_to_change) {
      const name_info = this.parse_track_name(track.name)
      if (name_info === null) continue

      const values = track.values
      for (let i = 0; i < values.length; i += 4) {
        const original_quat: Quaternion = new Quaternion(
          values[i], // x
          values[i + 1], // y
          values[i + 2], // z
          values[i + 3] // w
        )

        // if the track is a left/right combo, we may need to invert the rotation on one side
        // if there is no left/right info, this will be skipped and work as normal

        if (name_info.bone_name.toLowerCase().includes('left')) {
          rotation_amount = new Quaternion().setFromEuler(new Euler(-rotate_obj.x, -rotate_obj.y, -rotate_obj.z, 'XYZ'))
        } else {
          rotation_amount = new Quaternion().setFromEuler(rotate_obj) // original value brought in
        }



        // have an option with how to rotate things
        if (space === 'local') {
          original_quat.multiply(rotation_amount)
        } else {
          original_quat.premultiply(rotation_amount)
        }

        values[i] = original_quat.x
        values[i + 1] = original_quat.y
        values[i + 2] = original_quat.z
        values[i + 3] = original_quat.w
      }
    }
  }

  /**
   * Apply Mixamo-specific corrections to retargeted animation
   * Mixamo rigs don't have a root bone, so we need to rotate the hips by -90 degrees on X axis
   */
  private apply_mixamo_corrections (animation_clip: AnimationClip): void {
    // hips fix - Mixamo hips are rotated -90 degrees on X axis compared to M2M standard
    // this hips rotation is temporary. It would be better to rotate the entire skinned mesh by -90 degrees on X axis
    let rotation_amount: Euler = new Euler(this.deg_to_rad(-90), 0, 0, 'XYZ')
    this.rotate_bone_for_retargeting(animation_clip, ['hips'], rotation_amount, 'world')

    // shoulder fix - Mixamo shoulders are rotated 180 degrees on X axis compared to M2M standard
    rotation_amount = new Euler(0, this.deg_to_rad(-180), 0, 'XYZ')
    this.rotate_bone_for_retargeting(animation_clip, ['shoulder'], rotation_amount, 'local')


    // should fix 2 - Tilt shoulder back a bit along the Y axis
    // rotation_amount = new Euler(this.deg_to_rad(30), 0, 0, 'XYZ')
    // this.rotate_bone_for_retargeting(animation_clip, ['RightArm', 'LeftArm'], rotation_amount, 'local')

    // upper arm fix - Mixamo upper arms are rotated 90 degrees on X axis compared to M2M standard
    // rotation_amount = new Euler(0, this.deg_to_rad(90), 0, 'XYZ')
    // this.rotate_bone_for_retargeting(animation_clip, ['RightArm', 'LeftArm'], rotation_amount, 'local')



    console.log('Applied Mixamo-specific corrections to retargeted animation', animation_clip)
  }

  // helps when specifying rotations in degrees with retargeting corrections
  private deg_to_rad (deg: number): number {
    return deg * Math.PI / 180
  }

  /**
   * Parse a track name to extract bone name and property
   * Handles various formats like "boneName.property" or ".bones[boneName].property"
   */
  private parse_track_name (track_name: string): { bone_name: string, property: string } | null {
    // Try format: "boneName.property"
    const simple_match = track_name.match(/^([^.]+)\.(.+)$/)
    if (simple_match !== null) {
      return {
        bone_name: simple_match[1],
        property: simple_match[2]
      }
    }

    // Try format: ".bones[boneName].property"
    const bones_match = track_name.match(/\.bones\[([^\]]+)\]\.(.+)$/)
    if (bones_match !== null) {
      return {
        bone_name: bones_match[1],
        property: bones_match[2]
      }
    }

    return null
  }

  /**
   * Create a track name in the format expected by Three.js
   * For named bones, use: BoneName.property
   */
  private create_track_name (bone_name: string, property: string): string {
    return `${bone_name}.${property}`
  }

  /**
   * Update animation mixer on each frame
   */
  public update (delta_time: number): void {
    if (this.animation_mixer !== null && this.is_preview_active) {
      this.animation_mixer.update(delta_time)

      // CRITICAL: Update the skeleton and skinned meshes after animation changes the bones
      // Why do I need this when I don't need it in the main Mesh2Motion engine?
      this.target_skinned_meshes.forEach((skinned_mesh) => {
        skinned_mesh.skeleton.bones.forEach(bone => {
          bone.updateMatrixWorld(true)
        })
      })
    }
  }

  /**
   * Check if preview is currently active
   */
  public is_active (): boolean {
    return this.is_preview_active
  }
}
