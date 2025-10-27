import trimesh
import numpy as np
import json
from trimesh import creation, primitives, transformations
from trimesh.scene.scene import Scene
from trimesh.visual.material import PBRMaterial
import math

def crear_material(color_base, metalico=0.0, rugosidad=0.5):
    """Crea un material PBR para el modelo 3D"""
    material = PBRMaterial(
        baseColorFactor=color_base,
        metallicFactor=metalico,
        roughnessFactor=rugosidad
    )
    return material

def crear_calavera_completa():
    """Crea una calavera completa con todos los componentes"""
    
    # Crear la cabeza principal (esfera ligeramente deformada)
    cabeza = creation.icosphere(subdivisions=3, radius=1.0)
    
    # Deformar la cabeza para dar forma de cráneo
    vertices = cabeza.vertices.copy()
    for i, vert in enumerate(vertices):
        x, y, z = vert
        # Hacer la cabeza más alta y ancha
        vertices[i] = [x * 1.0, y * 1.2, z * 1.3]
    
    cabeza.vertices = vertices
    cabeza.visual.material = crear_material([0.95, 0.95, 0.85, 1.0], 0.1, 0.7)
    
    # Crear cavidades para los ojos
    ojo_izq = creation.icosphere(subdivisions=2, radius=0.25)
    ojo_izq.apply_translation([-0.4, 0.3, 0.8])
    ojo_izq.visual.material = crear_material([0.0, 0.0, 0.0, 1.0], 0.0, 0.9)
    
    ojo_der = creation.icosphere(subdivisions=2, radius=0.25)
    ojo_der.apply_translation([0.4, 0.3, 0.8])
    ojo_der.visual.material = crear_material([0.0, 0.0, 0.0, 1.0], 0.0, 0.9)
    
    # Crear nariz (cavidad en forma de corazón)
    nariz = creation.icosphere(subdivisions=2, radius=0.15)
    nariz.apply_translation([0, 0.1, 0.9])
    nariz.visual.material = crear_material([0.0, 0.0, 0.0, 1.0], 0.0, 0.9)
    
    # Crear mandíbula inferior
    mandibula = creation.icosphere(subdivisions=3, radius=0.7)
    mand_vertices = mandibula.vertices.copy()
    for i, vert in enumerate(mand_vertices):
        x, y, z = vert
        mand_vertices[i] = [x * 0.8, y * 0.6, z * 0.4]
    mandibula.vertices = mand_vertices
    mandibula.apply_translation([0, -0.4, 0.3])
    mandibula.visual.material = crear_material([0.95, 0.95, 0.85, 1.0], 0.1, 0.7)
    
    # Crear dientes
    dientes = []
    geometria_diente = creation.box(extents=[0.08, 0.15, 0.05])
    
    for i in range(8):
        x = -0.35 + i * 0.1
        
        # Dientes superiores
        diente_sup = geometria_diente.copy()
        diente_sup.apply_translation([x, -0.1, 0.85])
        diente_sup.visual.material = crear_material([0.95, 0.95, 0.85, 1.0], 0.1, 0.5)
        dientes.append(diente_sup)
        
        # Dientes inferiores
        diente_inf = geometria_diente.copy()
        diente_inf.apply_translation([x, -0.6, 0.75])
        diente_inf.visual.material = crear_material([0.95, 0.95, 0.85, 1.0], 0.1, 0.5)
        dientes.append(diente_inf)
    
    # Crear flores decorativas
    flores = []
    colores_flores = [
        [[1.0, 0.2, 0.6, 1.0], [-0.5, 0.8, 0.5]],  # Rosa
        [[1.0, 0.6, 0.0, 1.0], [0.5, 0.8, 0.5]],   # Naranja
        [[0.8, 0.2, 0.8, 1.0], [0, 1.0, 0.3]]      # Morado
    ]
    
    for color, posicion in colores_flores:
        # Centro de la flor
        centro = creation.icosphere(subdivisions=2, radius=0.1)
        centro.apply_translation(posicion)
        centro.visual.material = crear_material(color, 0.2, 0.4)
        flores.append(centro)
        
        # Pétalos
        for i in range(6):
            angulo = (i * 60) * math.pi / 180
            petalo_x = posicion[0] + math.cos(angulo) * 0.15
            petalo_y = posicion[1] + math.sin(angulo) * 0.15
            petalo_z = posicion[2]
            
            petalo = creation.icosphere(subdivisions=1, radius=0.08)
            petalo.apply_translation([petalo_x, petalo_y, petalo_z])
            petalo.visual.material = crear_material(color, 0.2, 0.4)
            flores.append(petalo)
    
    # Crear decoraciones faciales
    decoraciones = []
    patrones = [
        # Patrones en la frente
        [[0.0, 0.0, 0.0, 1.0], [-0.2, 0.6, 1.0], [0.1, 0.1, 0.01]],
        [[0.0, 0.0, 0.0, 1.0], [0.2, 0.6, 1.0], [0.1, 0.1, 0.01]],
        [[1.0, 0.2, 0.6, 1.0], [0, 0.7, 1.0], [0.15, 0.15, 0.01]],
        
        # Patrones en las mejillas
        [[1.0, 0.6, 0.0, 1.0], [-0.7, 0.2, 0.8], [0.12, 0.12, 0.01]],
        [[0.8, 0.2, 0.8, 1.0], [0.7, 0.2, 0.8], [0.12, 0.12, 0.01]],
        
        # Patrones en la barbilla
        [[0.0, 0.0, 0.0, 1.0], [-0.3, -0.7, 0.9], [0.08, 0.08, 0.01]],
        [[0.0, 0.0, 0.0, 1.0], [0.3, -0.7, 0.9], [0.08, 0.08, 0.01]]
    ]
    
    for color, posicion, escala in patrones:
        deco = creation.box(extents=[1, 1, 1])
        deco.apply_translation(posicion)
        deco.vertices *= np.array(escala)
        deco.visual.material = crear_material(color, 0.0, 0.9)
        decoraciones.append(deco)
    
    # Combinar todos los componentes
    geometrias = [cabeza, ojo_izq, ojo_der, nariz, mandibula] + dientes + flores + decoraciones
    
    return geometrias

def crear_animaciones():
    """Crea datos de animación para el modelo"""
    animaciones = {
        "animations": [
            {
                "name": "Rotacion_Cabeza",
                "duration": 4.0,
                "tracks": [
                    {
                        "name": "Calavera.rotation[y]",
                        "type": "quaternion",
                        "keys": [
                            {"time": 0.0, "value": [0, 0, 0, 1]},
                            {"time": 1.0, "value": [0, 0.259, 0, 0.966]},
                            {"time": 2.0, "value": [0, -0.259, 0, 0.966]},
                            {"time": 3.0, "value": [0, 0, 0, 1]},
                            {"time": 4.0, "value": [0, 0, 0, 1]}
                        ]
                    }
                ]
            },
            {
                "name": "Masticar",
                "duration": 2.0,
                "tracks": [
                    {
                        "name": "Mandibula.position[y]",
                        "type": "vector",
                        "keys": [
                            {"time": 0.0, "value": -0.4},
                            {"time": 0.5, "value": -0.5},
                            {"time": 1.0, "value": -0.4},
                            {"time": 1.5, "value": -0.5},
                            {"time": 2.0, "value": -0.4}
                        ]
                    }
                ]
            },
            {
                "name": "Escala_Suave",
                "duration": 3.0,
                "tracks": [
                    {
                        "name": "Calavera.scale",
                        "type": "vector",
                        "keys": [
                            {"time": 0.0, "value": [1.0, 1.0, 1.0]},
                            {"time": 1.5, "value": [1.1, 1.1, 1.1]},
                            {"time": 3.0, "value": [1.0, 1.0, 1.0]}
                        ]
                    }
                ]
            }
        ]
    }
    
    return animaciones

def exportar_glb():
    """Exporta el modelo completo como archivo GLB"""
    print("🌺 Iniciando creación de calavera de Día de Muertos...")
    
    # Crear todos los componentes
    componentes = crear_calavera_completa()
    
    # Crear escena
    scene = Scene()
    
    # Añadir todos los componentes a la escena
    for componente in componentes:
        scene.add_geometry(componente)
    
    # Crear animaciones
    animaciones = crear_animaciones()
    
    # Exportar como GLB
    output_path = "./calavera_dia_muertos.glb"
    
    try:
        # Exportar el modelo
        scene.export(output_path)
        
        # Guardar animaciones por separado (trimesh no soporta animaciones GLB directamente)
        anim_path = "./animaciones_calavera.json"
        with open(anim_path, 'w', encoding='utf-8') as f:
            json.dump(animaciones, f, indent=2, ensure_ascii=False)
        
        print("✅ Calavera de Día de Muertos creada exitosamente!")
        print(f"📁 Modelo guardado en: {output_path}")
        print(f"📁 Animaciones guardadas en: {anim_path}")
        print("🎨 La calavera incluye:")
        print("   • Cabeza principal con forma de cráneo")
        print("   • Ojos y nariz con cavidades")
        print("   • Mandíbula inferior con dientes")
        print("   • Flores decorativas coloridas")
        print("   • Patrones decorativos faciales")
        print("   • Material de hueso realista")
        print("   • Animaciones predefinidas")
        
        return True
        
    except Exception as e:
        print(f"❌ Error al exportar el modelo: {e}")
        return False

if __name__ == "__main__":
    exportar_glb()