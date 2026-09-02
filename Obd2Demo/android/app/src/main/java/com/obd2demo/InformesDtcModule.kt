package com.obd2demo

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.BaseReactPackage
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.concurrent.Executors

/** Guarda JSON mediante el selector de Android, sin permisos de almacenamiento global. */
class InformesDtcModule(private val contexto: ReactApplicationContext) : ReactContextBaseJavaModule(contexto) {
  private data class Guardado(val json: String, val promesa: Promise)
  private var pendiente: Guardado? = null
  private val escritor = Executors.newSingleThreadExecutor()
  private val codigoSolicitud = 48231

  private val eventos = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != codigoSolicitud) return
      val trabajo = pendiente ?: return
      pendiente = null
      if (resultCode != Activity.RESULT_OK) {
        trabajo.promesa.resolve(null)
        return
      }
      val uri = data?.data
      if (uri == null) {
        trabajo.promesa.reject("SIN_DESTINO", "Android no devolvio un destino para guardar.")
        return
      }
      // El proveedor puede ser local o remoto; nunca bloquear el hilo de interfaz.
      escritor.execute {
        try {
          val flujo = contexto.contentResolver.openOutputStream(uri, "w")
            ?: throw IllegalStateException("No se pudo abrir el archivo de destino.")
          flujo.bufferedWriter(Charsets.UTF_8).use { it.write(trabajo.json) }
          trabajo.promesa.resolve(uri.toString())
        } catch (error: Exception) {
          trabajo.promesa.reject("ERROR_GUARDADO", "No se pudo completar el archivo; revisa el destino y reintenta.", error)
        }
      }
    }
  }

  init { contexto.addActivityEventListener(eventos) }
  override fun getName() = "InformesDtc"

  @ReactMethod
  fun guardarJson(nombre: String, json: String, promesa: Promise) {
    UiThreadUtil.runOnUiThread {
      if (pendiente != null) {
        promesa.reject("GUARDADO_EN_CURSO", "Ya hay un selector de guardado abierto.")
        return@runOnUiThread
      }
      val actividad = contexto.currentActivity
      if (actividad == null) {
        promesa.reject("SIN_ACTIVIDAD", "Abre la aplicacion para elegir donde guardar.")
        return@runOnUiThread
      }
      if (!nombre.matches(Regex("[A-Za-z0-9_.-]+\\.json"))) {
        promesa.reject("NOMBRE_INVALIDO", "El nombre del informe no es valido.")
        return@runOnUiThread
      }
      pendiente = Guardado(json, promesa)
      try {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "application/json"
          putExtra(Intent.EXTRA_TITLE, nombre)
        }
        actividad.startActivityForResult(intent, codigoSolicitud)
      } catch (error: Exception) {
        pendiente = null
        promesa.reject("SIN_SELECTOR", "No se pudo abrir el selector de archivos.", error)
      }
    }
  }

  override fun invalidate() {
    contexto.removeActivityEventListener(eventos)
    pendiente?.promesa?.reject("MODULO_CERRADO", "El modulo se cerro antes de guardar.")
    pendiente = null
    escritor.shutdown()
    super.invalidate()
  }
}

class InformesDtcPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == "InformesDtc") InformesDtcModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf("InformesDtc" to ReactModuleInfo(
      "InformesDtc", InformesDtcModule::class.java.name, false, false, false, false
    ))
  }
}
